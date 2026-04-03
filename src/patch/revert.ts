import { readFileSync } from 'node:fs'

import { revertPatchFromFile } from './js-engine'
import { loadManifestPackage, resolveRepoRoot } from './manifest'
import { markerPathForRepo, readMarker, removeMarker } from './marker'
import { runPatchVerify, type PatchVerifyOptions } from './verify'

const TARGET_PACKAGE = 'opencode-anthropic-auth'

type RevertState = 'clean' | 'drift' | 'incompatible' | 'failed'

export type PatchRevertResult = {
  packageName: string
  state: RevertState
  output: string
  exitCode: number
  peerRoot?: string
  markerPath?: string
  reason?: string
}

function runPatchReverse(patchPath: string, peerRoot: string): { ok: boolean; message?: string } {
  const patchContent = readFileSync(patchPath, 'utf8')
  const run = revertPatchFromFile(patchContent, peerRoot)
  return {
    ok: run.ok,
    message: run.message,
  }
}

function formatOutput(result: PatchRevertResult): string {
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

export function runPatchRevert(options: PatchVerifyOptions = {}): PatchRevertResult {
  const repoRoot = resolveRepoRoot(options.repoRoot)
  const markerPath = markerPathForRepo(repoRoot)
  const marker = readMarker(markerPath)

  const pre = runPatchVerify({
    ...options,
    peerRootOverride: marker?.peerRoot,
  })

  if (pre.state === 'clean') {
    removeMarker(markerPath)
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'clean',
      peerRoot: pre.peerRoot,
      markerPath,
      reason: marker ? 'already_clean_removed_stale_marker' : 'already_clean',
      output: '',
      exitCode: 0,
    }
    result.output = formatOutput(result)
    return result
  }

  if (pre.state === 'incompatible') {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'incompatible',
      peerRoot: pre.peerRoot,
      markerPath,
      reason: pre.reason,
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  if (pre.state === 'drift') {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'drift',
      peerRoot: pre.peerRoot,
      markerPath,
      reason: pre.mismatches[0] ?? pre.reason,
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  if (!marker) {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'incompatible',
      peerRoot: pre.peerRoot,
      markerPath,
      reason: 'rollback_marker_missing',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  if (pre.peerRoot !== marker.peerRoot) {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'incompatible',
      peerRoot: pre.peerRoot,
      markerPath,
      reason: 'rollback_marker_peer_root_mismatch',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
  if (!manifest) {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'incompatible',
      peerRoot: pre.peerRoot,
      markerPath,
      reason: 'manifest_or_patch_missing',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  if (marker.patchSha256 !== manifest.patchSha256) {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'incompatible',
      peerRoot: pre.peerRoot,
      markerPath,
      reason: 'rollback_marker_patch_hash_mismatch',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const reverted = runPatchReverse(manifest.patchPath, marker.peerRoot)
  if (!reverted.ok) {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'failed',
      peerRoot: marker.peerRoot,
      markerPath,
      reason: reverted.message ?? 'git_apply_reverse_failed',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const post = runPatchVerify({ ...options, peerRootOverride: marker.peerRoot })
  if (post.state !== 'clean') {
    const result: PatchRevertResult = {
      packageName: TARGET_PACKAGE,
      state: 'failed',
      peerRoot: marker.peerRoot,
      markerPath,
      reason: `post_revert_state_unexpected ${post.state}`,
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  removeMarker(markerPath)
  const result: PatchRevertResult = {
    packageName: TARGET_PACKAGE,
    state: 'clean',
    peerRoot: marker.peerRoot,
    markerPath,
    output: '',
    exitCode: 0,
  }
  result.output = formatOutput(result)
  return result
}
