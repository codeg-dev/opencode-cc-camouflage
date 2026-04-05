import { spawnSync } from 'node:child_process'
import { accessSync, constants, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'

import type { EmulatorStatus, PatchStatus, StatusContract } from '../contracts/status'
import { discoverPeer } from './peer-discovery'
import { publishedPatchPreflightChecks } from './published-metadata'
import { detectSupport } from './support-matrix'

export interface DetectStatusOptions {
  homeDir?: string
  cwd?: string
  platform?: string
  repoRoot?: string
}

const EMULATOR_PACKAGE_NAME = 'not-claude-code-emulator'

type NpmGlobalRootSpawnSync = (
  command: string,
  args: string[],
  options: {
    encoding: BufferEncoding
    timeout: number
  },
) => {
  error?: NodeJS.ErrnoException
  status: number | null
  stdout: string
}

const defaultNpmGlobalRootSpawnSync: NpmGlobalRootSpawnSync = (command, args, options) =>
  spawnSync(command, args, options)

let runNpmGlobalRootSpawnSync: NpmGlobalRootSpawnSync = defaultNpmGlobalRootSpawnSync

export function setDetectSpawnSyncForTests(spawnSyncImpl: NpmGlobalRootSpawnSync): void {
  runNpmGlobalRootSpawnSync = spawnSyncImpl
}

export function resetDetectSpawnSyncForTests(): void {
  runNpmGlobalRootSpawnSync = defaultNpmGlobalRootSpawnSync
}

function isRecognizedEmulatorRoot(candidate: string): boolean {
  const packageJsonPath = join(candidate, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string }
      if (parsed.name === EMULATOR_PACKAGE_NAME) {
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

function resolveCandidatePath(homeDir: string, rawPath: string): string {
  return resolve(homeDir, rawPath.replace(/^~[/\\]/, ''))
}

function inspectCandidate(candidate: string): EmulatorStatus | undefined {
  if (!existsSync(candidate)) {
    return undefined
  }

  try {
    accessSync(candidate, constants.R_OK)
  } catch {
    return 'unreachable'
  }

  return isRecognizedEmulatorRoot(candidate) ? 'present' : 'unreachable'
}

function detectFromNpmGlobalRoot(): EmulatorStatus | undefined {
  try {
    const result = runNpmGlobalRootSpawnSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 5000 })
    const error = result.error as NodeJS.ErrnoException | undefined

    if (error?.code === 'ENOENT') {
      return undefined
    }

    if (error || result.status !== 0) {
      return undefined
    }

    const npmRoot = result.stdout.trim()
    if (!npmRoot) {
      return undefined
    }

    return inspectCandidate(join(npmRoot, EMULATOR_PACKAGE_NAME))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }

    return undefined
  }
}

function detectFromConfiguredFallbacks(homeDir: string): EmulatorStatus | undefined {
  const configured = process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS?.trim()
  if (!configured) {
    return undefined
  }

  const rawPaths = configured
    .split(delimiter)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0)

  for (const rawPath of rawPaths) {
    const result = inspectCandidate(resolveCandidatePath(homeDir, rawPath))
    if (result) {
      return result
    }
  }

  return undefined
}

function detectEmulatorPrerequisite(homeDir: string | undefined): EmulatorStatus {
  if (!homeDir) {
    return 'missing'
  }

  const explicitRoot = process.env.CC_CAMOUFLAGE_EMULATOR_ROOT?.trim()
  if (explicitRoot) {
    const explicitResult = inspectCandidate(resolveCandidatePath(homeDir, explicitRoot))
    if (explicitResult) {
      return explicitResult
    }
  }

  const npmGlobalResult = detectFromNpmGlobalRoot()
  if (npmGlobalResult) {
    return npmGlobalResult
  }

  const fallbackResult = detectFromConfiguredFallbacks(homeDir)
  if (fallbackResult) {
    return fallbackResult
  }

  return 'missing'
}

function detectPatchStatus(peerRoot: string | undefined, supported: boolean): PatchStatus {
  if (!supported || !peerRoot || publishedPatchPreflightChecks.length === 0) {
    return 'incompatible'
  }

  for (const check of publishedPatchPreflightChecks) {
    const primaryTarget = resolve(peerRoot, check.targetPath)

    if (!existsSync(primaryTarget)) {
      if (check.fallbackPath) {
        const fallbackTarget = resolve(peerRoot, check.fallbackPath)
        if (!existsSync(fallbackTarget)) {
          return 'drift'
        }
        const fallbackContents = readFileSync(fallbackTarget, 'utf8')
        if (!fallbackContents.includes(check.contains)) {
          return 'drift'
        }
      } else {
        return 'drift'
      }
      continue
    }

    const contents = readFileSync(primaryTarget, 'utf8')
    if (!contents.includes(check.contains)) {
      return 'drift'
    }
  }

  return 'clean'
}

export function detectStatus(options: DetectStatusOptions = {}): StatusContract {
  const homeDir = options.homeDir ?? homedir()
  const cwd = options.cwd ?? process.cwd()
  const platform = options.platform ?? process.env.CC_CAMOUFLAGE_PLATFORM ?? process.platform

  const supportResult = detectSupport(platform)
  const peerResult = discoverPeer({ homeDir, cwd })
  const emulator = detectEmulatorPrerequisite(homeDir)
  const patch = detectPatchStatus(peerResult.peer === 'present' ? peerResult.peerRoot : undefined, supportResult.support === 'supported')

  return {
    peer: peerResult.peer,
    emulator,
    patch,
    install_mode: peerResult.install_mode,
    support: supportResult.support,
  }
}
