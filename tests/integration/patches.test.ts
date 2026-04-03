import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { clearPatchMarkerForTests, runPatchApply } from '../../src/patch/apply'
import { runPatchRevert } from '../../src/patch/revert'
import { runPatchVerify } from '../../src/patch/verify'
import { plugin } from '../../src/index'
import { prepareScenarioFromHome } from '../helpers/peer-scenario'
import { createTempHome } from '../helpers/temp-home'

const repoRoot = resolve(import.meta.dir, '..', '..')
const originalFallbackPaths = process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS

type ManifestSourceFile = {
  fixturePath: string
  sha256: string
}

type PatchManifest = {
  schemaVersion: number
  packages: Array<{
    name: string
    upstream: { repo: string; sha: string }
    sourceFiles: ManifestSourceFile[]
    patchFiles: Array<{ path: string; sha256: string }>
    preflightTargetChecks: Array<{ targetPath: string; contains: string }>
    rollbackMarkerNaming: string
  }>
}

function sha256(path: string): string {
  const value = readFileSync(path)
  return createHash('sha256').update(value).digest('hex')
}

async function createSandboxRepo(): Promise<string> {
  const sandboxRoot = await mkdtemp(join(tmpdir(), 'patches-integration-repo-'))
  await cp(resolve(repoRoot, 'patches'), resolve(sandboxRoot, 'patches'), { recursive: true })
  return sandboxRoot
}

describe('verify:patches contract', () => {
  beforeEach(() => {
    process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = '~/github/not-claude-code-emulator'
  })

  afterEach(() => {
    if (originalFallbackPaths === undefined) {
      delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
    } else {
      process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = originalFallbackPaths
    }
  })

  test('root plugin export exposes the stable server plugin module', () => {
    expect(plugin.id).toBe('opencode-cc-camouflage')
    expect(plugin.server).toBeTypeOf('function')
  })

  test('manifest pins opencode-anthropic-auth upstream and fixture snapshots', () => {
    const manifestPath = resolve(repoRoot, 'patches/manifest.json')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PatchManifest
    expect(manifest.schemaVersion).toBe(1)

    const pkg = manifest.packages.find((item) => item.name === 'opencode-anthropic-auth')
    expect(pkg).toBeDefined()
    expect(pkg?.upstream.sha).toBe('6594dd1f1ff8b63342f83173d4477f8b549b4867')

    for (const sourceFile of pkg?.sourceFiles ?? []) {
      const fixturePath = resolve(repoRoot, sourceFile.fixturePath)
      expect(existsSync(fixturePath)).toBe(true)
      expect(sha256(fixturePath)).toBe(sourceFile.sha256)
    }

    for (const patchFile of pkg?.patchFiles ?? []) {
      const patchPath = resolve(repoRoot, patchFile.path)
      expect(existsSync(patchPath)).toBe(true)
      expect(sha256(patchPath)).toBe(patchFile.sha256)
    }

    for (const check of pkg?.preflightTargetChecks ?? []) {
      const fixtureTarget = resolve(
        repoRoot,
        'fixtures/upstream/opencode-anthropic-auth/6594dd1f1ff8b63342f83173d4477f8b549b4867',
        check.targetPath,
      )
      const contents = readFileSync(fixtureTarget, 'utf8')
      expect(contents.includes(check.contains)).toBe(true)
    }

    expect(pkg?.rollbackMarkerNaming).toContain('rollback.opencode-anthropic-auth')
  })

  test('new JS engine keeps verify/apply/revert flow consistent against the pinned fixture', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-patches-flow' })
    const sandboxRepo = await createSandboxRepo()

    try {
      await prepareScenarioFromHome(fixture.root)
      clearPatchMarkerForTests({ repoRoot: sandboxRepo })

      const cleanVerify = runPatchVerify({ homeDir: fixture.root, repoRoot: sandboxRepo })
      expect(cleanVerify.state).toBe('clean')
      expect(cleanVerify.exitCode).toBe(0)
      expect(cleanVerify.patchSha256).toBeTypeOf('string')
      expect(cleanVerify.output).toContain('patch=clean')
      expect(cleanVerify.output).toContain('peer_root=')

      const apply = runPatchApply({ homeDir: fixture.root, repoRoot: sandboxRepo })
      expect(apply.state).toBe('applied')
      expect(apply.exitCode).toBe(0)
      expect(apply.output).toContain('patch=applied')
      expect(apply.output).toContain('marker=')

      const appliedVerify = runPatchVerify({ homeDir: fixture.root, repoRoot: sandboxRepo })
      expect(appliedVerify.state).toBe('applied')
      expect(appliedVerify.exitCode).toBe(0)
      expect(appliedVerify.reason).toBe('reverse_patch_check_ok')
      expect(appliedVerify.output).toContain('patch=applied')

      const revert = runPatchRevert({ homeDir: fixture.root, repoRoot: sandboxRepo })
      expect(revert.state).toBe('clean')
      expect(revert.exitCode).toBe(0)
      expect(revert.output).toContain('patch=clean')

      const postRevertVerify = runPatchVerify({ homeDir: fixture.root, repoRoot: sandboxRepo })
      expect(postRevertVerify.state).toBe('clean')
      expect(postRevertVerify.exitCode).toBe(0)
      expect(postRevertVerify.output).toContain('patch=clean')
    } finally {
      clearPatchMarkerForTests({ repoRoot: sandboxRepo })
      await fixture.cleanup()
      await rm(sandboxRepo, { recursive: true, force: true })
    }
  })
})
