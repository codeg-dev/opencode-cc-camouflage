import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { loadManifestPackage } from '../../src/patch/manifest'
import { runPatchVerify } from '../../src/patch/verify'

const TARGET_PACKAGE = 'opencode-anthropic-auth'
const repoRoot = resolve(import.meta.dir, '..', '..')

type ParityState = 'clean' | 'applied' | 'drift'

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function runPatchBinaryDryRun(patchPath: string, peerRoot: string, reverse: boolean): { ok: boolean; message: string } {
  const args = ['--dry-run', '--fuzz=0', '-p1', '-i', patchPath]
  if (reverse) {
    args.unshift('-R')
  } else {
    args.unshift('-N')
  }

  const run = spawnSync('patch', args, {
    cwd: peerRoot,
    encoding: 'utf8',
  })

  return {
    ok: (run.status ?? 1) === 0,
    message: run.stderr?.trim() || run.stdout?.trim() || '',
  }
}

async function createSandboxRepo(): Promise<string> {
  const sandboxRoot = await mkdtemp(join(tmpdir(), 'patch-dryrun-repo-'))
  await cp(resolve(repoRoot, 'patches'), resolve(sandboxRoot, 'patches'), { recursive: true })
  return sandboxRoot
}

async function preparePeerFromFixture(peerRoot: string): Promise<void> {
  const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
  if (!manifest) {
    throw new Error('missing manifest package for parity test')
  }

  expect(manifest.packageSpec.patchFiles).toHaveLength(1)

  for (const source of manifest.packageSpec.sourceFiles) {
    const fixturePath = resolve(repoRoot, source.fixturePath)
    const targetPath = resolve(peerRoot, source.upstreamPath)
    await mkdir(dirname(targetPath), { recursive: true })
    await cp(fixturePath, targetPath)
  }
}

async function makeDrift(peerRoot: string): Promise<void> {
  const indexPath = resolve(peerRoot, 'src', 'index.ts')
  const current = await readFile(indexPath, 'utf8')
  const next = current.replace("grant_type: 'refresh_token'", 'grant_type: refreshTokenKind')
  if (next === current) {
    throw new Error('failed to create drift fixture: expected anchor not found')
  }
  await writeFile(indexPath, next, 'utf8')
}

async function classifyDryRunState(peerRoot: string, patchPath: string): Promise<ParityState> {
  const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
  if (!manifest) {
    throw new Error('missing manifest package for parity test')
  }

  let cleanPreflightOk = true
  for (const source of manifest.packageSpec.sourceFiles) {
    const targetPath = resolve(peerRoot, source.upstreamPath)
    const targetHash = sha256(await readFile(targetPath))
    if (targetHash !== source.sha256) {
      cleanPreflightOk = false
      break
    }
  }

  if (cleanPreflightOk) {
    for (const check of manifest.packageSpec.preflightTargetChecks) {
      const targetPath = resolve(peerRoot, check.targetPath)
      const content = await readFile(targetPath, 'utf8')
      if (!content.includes(check.contains)) {
        cleanPreflightOk = false
        break
      }
    }
  }

  const applyCheck = runPatchBinaryDryRun(patchPath, peerRoot, false)
  const revertCheck = runPatchBinaryDryRun(patchPath, peerRoot, true)

  if (cleanPreflightOk && applyCheck.ok) {
    return 'clean'
  }

  if (revertCheck.ok && !applyCheck.ok) {
    return 'applied'
  }

  return 'drift'
}

describe('patch dry-run parity', () => {
  test('binary dry-run and JS verify classify clean/applied/drift identically', async () => {
    const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
    if (!manifest) {
      throw new Error('missing manifest package for parity test')
    }

    const sandboxRepo = await createSandboxRepo()
    const cleanRoot = await mkdtemp(join(tmpdir(), 'patch-dryrun-clean-'))
    const appliedRoot = await mkdtemp(join(tmpdir(), 'patch-dryrun-applied-'))
    const driftRoot = await mkdtemp(join(tmpdir(), 'patch-dryrun-drift-'))

    try {
      await preparePeerFromFixture(cleanRoot)
      await preparePeerFromFixture(appliedRoot)
      await preparePeerFromFixture(driftRoot)

      const applyRun = spawnSync('patch', ['-N', '--fuzz=0', '-p1', '-i', manifest.patchPath], {
        cwd: appliedRoot,
        encoding: 'utf8',
      })
      expect(applyRun.status ?? 1).toBe(0)

      await makeDrift(driftRoot)

      const scenarios: Array<{ name: string; peerRoot: string }> = [
        { name: 'clean', peerRoot: cleanRoot },
        { name: 'applied', peerRoot: appliedRoot },
        { name: 'drift', peerRoot: driftRoot },
      ]

      for (const scenario of scenarios) {
        const goldenState = await classifyDryRunState(scenario.peerRoot, manifest.patchPath)
        const jsState = runPatchVerify({
          repoRoot: sandboxRepo,
          peerRootOverride: scenario.peerRoot,
          platform: 'darwin',
        }).state
        expect(jsState, scenario.name).toBe(goldenState)
      }
    } finally {
      await rm(cleanRoot, { recursive: true, force: true })
      await rm(appliedRoot, { recursive: true, force: true })
      await rm(driftRoot, { recursive: true, force: true })
      await rm(sandboxRepo, { recursive: true, force: true })
    }
  })
})
