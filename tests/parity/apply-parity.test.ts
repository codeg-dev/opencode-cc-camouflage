import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { clearPatchMarkerForTests, runPatchApply } from '../../src/patch/apply'
import { loadManifestPackage } from '../../src/patch/manifest'

const TARGET_PACKAGE = 'opencode-anthropic-auth'
const repoRoot = resolve(import.meta.dir, '..', '..')

type BinaryRun = {
  exitCode: number
  stdout: string
  stderr: string
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

function runPatchBinaryApply(patchPath: string, peerRoot: string): BinaryRun {
  const run = spawnSync('patch', ['-N', '--fuzz=0', '-p1', '-i', patchPath], {
    cwd: peerRoot,
    encoding: 'utf8',
  })

  return {
    exitCode: run.status ?? 1,
    stdout: run.stdout ?? '',
    stderr: run.stderr ?? '',
  }
}

async function snapshotTrackedFilesAtRoot(peerRoot: string): Promise<Map<string, Buffer>> {
  const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
  if (!manifest) {
    throw new Error('missing manifest package for parity test')
  }

  const files = new Map<string, Buffer>()
  for (const source of manifest.packageSpec.sourceFiles) {
    const targetPath = resolve(peerRoot, source.upstreamPath)
    files.set(source.upstreamPath, await readFile(targetPath))
  }
  return files
}

async function createSandboxRepo(): Promise<string> {
  const sandboxRoot = await mkdtemp(join(tmpdir(), 'patch-parity-repo-'))
  await cp(resolve(repoRoot, 'patches'), resolve(sandboxRoot, 'patches'), { recursive: true })
  return sandboxRoot
}

describe('patch apply parity', () => {
  test('patch binary and JS apply produce identical file contents', async () => {
    const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
    if (!manifest) {
      throw new Error('missing manifest package for parity test')
    }

    const sandboxRepo = await createSandboxRepo()
    const goldenPeerRoot = await mkdtemp(join(tmpdir(), 'patch-parity-golden-'))
    const jsPeerRoot = await mkdtemp(join(tmpdir(), 'patch-parity-js-'))

    try {
      await preparePeerFromFixture(goldenPeerRoot)
      await preparePeerFromFixture(jsPeerRoot)

      const golden = runPatchBinaryApply(manifest.patchPath, goldenPeerRoot)
      expect(golden.exitCode).toBe(0)

      const goldenSnapshot = await snapshotTrackedFilesAtRoot(goldenPeerRoot)

      clearPatchMarkerForTests({ repoRoot: sandboxRepo })
      const jsApply = runPatchApply({
        repoRoot: sandboxRepo,
        peerRootOverride: jsPeerRoot,
        platform: 'darwin',
      })
      expect(jsApply.exitCode).toBe(0)
      expect(jsApply.state).toBe('applied')

      const jsSnapshot = await snapshotTrackedFilesAtRoot(jsPeerRoot)

      expect(jsSnapshot.size).toBe(goldenSnapshot.size)
      for (const [path, goldenBytes] of goldenSnapshot) {
        const jsBytes = jsSnapshot.get(path)
        expect(jsBytes).toBeDefined()
        expect(jsBytes?.equals(goldenBytes)).toBe(true)
      }
    } finally {
      clearPatchMarkerForTests({ repoRoot: sandboxRepo })
      await rm(goldenPeerRoot, { recursive: true, force: true })
      await rm(jsPeerRoot, { recursive: true, force: true })
      await rm(sandboxRepo, { recursive: true, force: true })
    }
  })
})
