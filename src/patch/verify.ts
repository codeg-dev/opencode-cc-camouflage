import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

import { discoverPeer } from '../runtime/peer-discovery'
import { detectSupport } from '../runtime/support-matrix'
import { dryRunPatch } from './js-engine'
import { loadManifestPackage, sha256File, type LoadedManifestPackage } from './manifest'

const TARGET_PACKAGE = 'opencode-anthropic-auth'

export type PatchVerifyState = 'clean' | 'applied' | 'drift' | 'incompatible'

export type PatchVerifyResult = {
  packageName: string
  state: PatchVerifyState
  peer: 'present' | 'missing'
  support: 'supported' | 'unsupported'
  peerRoot?: string
  reason?: string
  mismatches: string[]
  patchSha256?: string
  output: string
  exitCode: number
}

export type PatchVerifyOptions = {
  homeDir?: string
  cwd?: string
  platform?: string
  repoRoot?: string
  peerRootOverride?: string
}

function runPatchDryRun(
  patchPath: string,
  peerRoot: string,
  options: { reverse?: boolean } = {},
): { ok: boolean; message?: string } {
  const patchContent = readFileSync(patchPath, 'utf8')
  const run = dryRunPatch(patchContent, peerRoot, { reverse: options.reverse })
  return {
    ok: run.ok,
    message: run.message,
  }
}

function validateManifestAndPatch(pkg: LoadedManifestPackage, mismatches: string[]): boolean {
  const actualPatchHash = sha256File(pkg.patchPath)
  if (actualPatchHash !== pkg.patchSha256) {
    mismatches.push(`patch_hash_mismatch expected=${pkg.patchSha256} actual=${actualPatchHash}`)
    return false
  }

  return true
}

function exactTargetChecks(pkg: LoadedManifestPackage, peerRoot: string, mismatches: string[]): boolean {
  for (const source of pkg.packageSpec.sourceFiles) {
    if (!source.upstreamPath || !source.sha256) {
      mismatches.push('manifest_source_entry_invalid')
      return false
    }

    const targetPath = resolve(peerRoot, source.upstreamPath)
    if (!existsSync(targetPath)) {
      mismatches.push(`missing_target ${source.upstreamPath}`)
      return false
    }

    const actual = sha256File(targetPath)
    if (actual !== source.sha256) {
      mismatches.push(
        `version_hash_mismatch target=${source.upstreamPath} expected=${source.sha256} actual=${actual}`,
      )
      return false
    }
  }

  for (const check of pkg.packageSpec.preflightTargetChecks) {
    if (!check.targetPath || !check.contains) {
      mismatches.push('manifest_preflight_entry_invalid')
      return false
    }

    const targetPath = resolve(peerRoot, check.targetPath)
    if (!existsSync(targetPath)) {
      mismatches.push(`missing_preflight_target ${check.targetPath}`)
      return false
    }

    const content = readFileSync(targetPath, 'utf8')
    if (!content.includes(check.contains)) {
      mismatches.push(`preflight_anchor_mismatch target=${check.targetPath}`)
      return false
    }
  }

  return true
}

function formatOutput(result: PatchVerifyResult): string {
  const lines = [
    `package=${result.packageName}`,
    `support=${result.support}`,
    `peer=${result.peer}`,
    `patch=${result.state}`,
  ]

  if (result.peerRoot) {
    lines.push(`peer_root=${result.peerRoot}`)
  }

  if (result.patchSha256) {
    lines.push(`patch_sha256=${result.patchSha256}`)
  }

  if (result.reason) {
    lines.push(`reason=${result.reason}`)
  }

  for (const mismatch of result.mismatches) {
    lines.push(`mismatch=${mismatch}`)
  }

  return lines.join('\n')
}

export function runPatchVerify(options: PatchVerifyOptions = {}): PatchVerifyResult {
  const cwd = options.cwd ?? process.cwd()
  const homeDir = options.homeDir ?? homedir()
  const platform = options.platform ?? process.env.CC_CAMOUFLAGE_PLATFORM ?? process.platform

  const support = detectSupport(platform)
  const peer = discoverPeer({ homeDir, cwd })
  const mismatches: string[] = []

  const baseResult: Omit<PatchVerifyResult, 'state' | 'output' | 'exitCode'> = {
    packageName: TARGET_PACKAGE,
    peer: peer.peer,
    support: support.support,
    peerRoot: options.peerRootOverride ?? (peer.peer === 'present' ? peer.peerRoot : undefined),
    mismatches,
  }

  if (support.support !== 'supported') {
    const result: PatchVerifyResult = {
      ...baseResult,
      state: 'incompatible',
      reason: `unsupported_platform ${support.platform}`,
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  if (!baseResult.peerRoot) {
    const result: PatchVerifyResult = {
      ...baseResult,
      state: 'incompatible',
      reason: 'peer_missing_or_undiscoverable',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot: options.repoRoot })
  if (!manifest) {
    const result: PatchVerifyResult = {
      ...baseResult,
      state: 'incompatible',
      reason: 'manifest_or_patch_missing',
      output: '',
      exitCode: 1,
    }
    result.output = formatOutput(result)
    return result
  }

  const patchOk = validateManifestAndPatch(manifest, mismatches)
  const cleanPreflightOk = patchOk && exactTargetChecks(manifest, baseResult.peerRoot, mismatches)
  const applyCheck = runPatchDryRun(manifest.patchPath, baseResult.peerRoot)
  const revertCheck = runPatchDryRun(manifest.patchPath, baseResult.peerRoot, { reverse: true })

  let state: PatchVerifyState = 'drift'
  let reason: string | undefined
  if (cleanPreflightOk && applyCheck.ok) {
    state = 'clean'
  } else if (revertCheck.ok && !applyCheck.ok) {
    state = 'applied'
    reason = 'reverse_patch_check_ok'
  } else {
    reason = applyCheck.message || revertCheck.message || 'preflight_or_patch_check_failed'
  }

  const result: PatchVerifyResult = {
    ...baseResult,
    patchSha256: manifest.patchSha256,
    state,
    reason,
    output: '',
    exitCode: state === 'drift' ? 1 : 0,
  }
  result.output = formatOutput(result)
  return result
}
