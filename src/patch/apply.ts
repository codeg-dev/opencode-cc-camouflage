import { readFileSync } from 'node:fs'

import { applyPatchToFile } from './js-engine'
import { loadManifestPackage, resolveRepoRoot } from './manifest'
import { markerPathForRepo, removeMarker, writeMarker } from './marker'
import { runPatchVerify, type PatchVerifyOptions } from './verify'

const TARGET_PACKAGE = 'opencode-anthropic-auth'

type ApplyState = 'applied' | 'already_applied' | 'drift' | 'incompatible' | 'failed'

export type PatchApplyResult = {
  packageName: string
  state: ApplyState
  output: string
  exitCode: number
  peerRoot?: string
  markerPath?: string
  reason?: string
}

function runPatchForward(patchPath: string, peerRoot: string): { ok: boolean; message?: string } {
  const patchContent = readFileSync(patchPath, 'utf8')
  const run = applyPatchToFile(patchContent, peerRoot)
  return {
    ok: run.ok,
    message: run.message,
  }
}

function formatOutput(result: PatchApplyResult): string {
  const lines = [`package=${result.packageName}`, `patch=${result.state}`]
  if (result.peerRoot) {
    lines.push(`peer_root=${result.peerRoot}`)
  }
  if (result.markerPath) {
    lines.push(`marker=${result.markerPath}`)
  }
  if (result.reason) {
    lines.push(`reason=${result.reason}`)
  }
  return lines.join('\n')
}

export function runPatchApply(options: PatchVerifyOptions = {}): PatchApplyResult {
  const repoRoot = resolveRepoRoot(options.repoRoot)
  const markerPath = markerPathForRepo(repoRoot)
  const preflight = runPatchVerify(options)

  if (preflight.state === 'applied') {
    const result: PatchApplyResult = {
      packageName: TARGET_PACKAGE,
      state: 'already_applied',
      peerRoot: preflight.peerRoot,
      markerPath,
      reason: 'reverse_patch_check_ok',
      output: '',
      exitCode: 0,
    }
    result.output = formatOutput(result)
    return result
  }

  if (preflight.state === 'incompatible') {
    const result: PatchApplyResult = {
      packageName: TARGET_PACKAGE,
      state: 'incompatible',
      peerRoot: preflight.peerRoot,
      markerPath,
      reason: preflight.reason,
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  if (preflight.state === 'drift') {
    const result: PatchApplyResult = {
      packageName: TARGET_PACKAGE,
      state: 'drift',
      peerRoot: preflight.peerRoot,
      markerPath,
      reason: preflight.mismatches[0] ?? preflight.reason,
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
  if (!manifest || !preflight.peerRoot) {
    const result: PatchApplyResult = {
      packageName: TARGET_PACKAGE,
      state: 'incompatible',
      markerPath,
      reason: 'manifest_or_peer_missing_after_preflight',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const applied = runPatchForward(manifest.patchPath, preflight.peerRoot)
  if (!applied.ok) {
    const result: PatchApplyResult = {
      packageName: TARGET_PACKAGE,
      state: 'failed',
      peerRoot: preflight.peerRoot,
      markerPath,
      reason: applied.message ?? 'git_apply_failed',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const post = runPatchVerify({ ...options, peerRootOverride: preflight.peerRoot })
  if (post.state !== 'applied') {
    const result: PatchApplyResult = {
      packageName: TARGET_PACKAGE,
      state: 'failed',
      peerRoot: preflight.peerRoot,
      markerPath,
      reason: `post_apply_state_unexpected ${post.state}`,
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  writeMarker(markerPath, {
    packageName: TARGET_PACKAGE,
    peerRoot: preflight.peerRoot,
    patchSha256: manifest.patchSha256,
    appliedAt: new Date().toISOString(),
  })

  const result: PatchApplyResult = {
    packageName: TARGET_PACKAGE,
    state: 'applied',
    peerRoot: preflight.peerRoot,
    markerPath,
    output: '',
    exitCode: 0,
  }
  result.output = formatOutput(result)
  return result
}

export function clearPatchMarkerForTests(options: { repoRoot?: string } = {}): void {
  const markerPath = markerPathForRepo(resolveRepoRoot(options.repoRoot))
  removeMarker(markerPath)
}
