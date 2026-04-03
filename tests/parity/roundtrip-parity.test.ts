import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { clearPatchMarkerForTests, runPatchApply } from '../../src/patch/apply'
import { loadManifestPackage } from '../../src/patch/manifest'
import { runPatchRevert } from '../../src/patch/revert'

const TARGET_PACKAGE = 'opencode-anthropic-auth'
const repoRoot = resolve(import.meta.dir, '..', '..')

function runPatchBinary(patchPath: string, peerRoot: string, reverse: boolean): number {
  const args = reverse
    ? ['-R', '--fuzz=0', '-p1', '-i', patchPath]
    : ['-N', '--fuzz=0', '-p1', '-i', patchPath]
  const run = spawnSync('patch', args, {
    cwd: peerRoot,
    encoding: 'utf8',
  })

  return run.status ?? 1
}

async function createSandboxRepo(): Promise<string> {
  const sandboxRoot = await mkdtemp(join(tmpdir(), 'patch-roundtrip-repo-'))
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

function expectSnapshotsEqual(actual: Map<string, Buffer>, expected: Map<string, Buffer>): void {
  expect(actual.size).toBe(expected.size)
  for (const [path, expectedBytes] of expected) {
    const actualBytes = actual.get(path)
    expect(actualBytes).toBeDefined()
    expect(actualBytes?.equals(expectedBytes)).toBe(true)
  }
}

describe('patch roundtrip parity', () => {
  test('apply then revert restores original bytes for binary and JS flows', async () => {
    const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
    if (!manifest) {
      throw new Error('missing manifest package for parity test')
    }

    const sandboxRepo = await createSandboxRepo()
    const goldenPeerRoot = await mkdtemp(join(tmpdir(), 'patch-roundtrip-golden-'))
    const jsPeerRoot = await mkdtemp(join(tmpdir(), 'patch-roundtrip-js-'))

    try {
      await preparePeerFromFixture(goldenPeerRoot)
      await preparePeerFromFixture(jsPeerRoot)

      const baseline = await snapshotTrackedFilesAtRoot(goldenPeerRoot)

      const goldenApplyCode = runPatchBinary(manifest.patchPath, goldenPeerRoot, false)
      expect(goldenApplyCode).toBe(0)
      const goldenRevertCode = runPatchBinary(manifest.patchPath, goldenPeerRoot, true)
      expect(goldenRevertCode).toBe(0)
      const goldenFinal = await snapshotTrackedFilesAtRoot(goldenPeerRoot)

      clearPatchMarkerForTests({ repoRoot: sandboxRepo })
      const jsApply = runPatchApply({
        repoRoot: sandboxRepo,
        peerRootOverride: jsPeerRoot,
        platform: 'darwin',
      })
      expect(jsApply.state).toBe('applied')
      expect(jsApply.exitCode).toBe(0)

      const jsRevert = runPatchRevert({
        repoRoot: sandboxRepo,
        peerRootOverride: jsPeerRoot,
        platform: 'darwin',
      })
      expect(jsRevert.state).toBe('clean')
      expect(jsRevert.exitCode).toBe(0)

      const jsFinal = await snapshotTrackedFilesAtRoot(jsPeerRoot)

      expectSnapshotsEqual(goldenFinal, baseline)
      expectSnapshotsEqual(jsFinal, baseline)
      expectSnapshotsEqual(jsFinal, goldenFinal)
    } finally {
      clearPatchMarkerForTests({ repoRoot: sandboxRepo })
      await rm(goldenPeerRoot, { recursive: true, force: true })
      await rm(jsPeerRoot, { recursive: true, force: true })
      await rm(sandboxRepo, { recursive: true, force: true })
    }
  })
})
