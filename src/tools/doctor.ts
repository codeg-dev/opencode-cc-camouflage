import { accessSync, constants, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { StatusContract } from '../contracts/status'
import { detectStatus, type DetectStatusOptions } from '../runtime/detect'
import { discoverPeer } from '../runtime/peer-discovery'
import { detectSupport } from '../runtime/support-matrix'
import { formatStatus } from './status'

const PEER_PACKAGE_NAME = '@ex-machina/opencode-anthropic-auth'

export type DoctorDiagnosis =
  | 'clean'
  | 'missing-peer'
  | 'missing-emulator'
  | 'unsupported'
  | 'drift'
  | 'readonly'
  | 'incompatible'

export interface DoctorResult {
  status: StatusContract
  diagnosis: DoctorDiagnosis
  output: string
  exitCode: number
  homeDir: string
  platform: string
  peerRoot?: string
  readonlyPath?: string
}

type DoctorPayload = Omit<DoctorResult, 'output' | 'exitCode'>

function resolveHomeDir(homeDir?: string): string {
  return homeDir ?? homedir()
}

function resolveCwd(cwd?: string): string {
  return cwd ?? process.cwd()
}

function resolvePlatform(platform?: string): string {
  return platform ?? process.env.CC_CAMOUFLAGE_PLATFORM ?? process.platform
}

function detectReadonlyPath(homeDir: string, peerRoot?: string): string | undefined {
  const candidates = [homeDir, join(homeDir, '.config'), join(homeDir, '.config', 'opencode'), peerRoot].filter(
    (candidate): candidate is string => Boolean(candidate && existsSync(candidate)),
  )

  return candidates.find((candidate) => {
    try {
      accessSync(candidate, constants.W_OK)
      return false
    } catch {
      return true
    }
  })
}

function diagnose(payload: DoctorPayload): DoctorDiagnosis {
  if (payload.readonlyPath) {
    return 'readonly'
  }

  if (payload.status.support === 'unsupported') {
    return 'unsupported'
  }

  if (payload.status.peer === 'missing') {
    return 'missing-peer'
  }

  if (payload.status.emulator !== 'present') {
    return 'missing-emulator'
  }

  if (payload.status.patch === 'drift') {
    return 'drift'
  }

  if (
    payload.status.support === 'supported' &&
    payload.status.peer === 'present' &&
    payload.status.emulator === 'present' &&
    payload.status.patch === 'clean'
  ) {
    return 'clean'
  }

  return 'incompatible'
}

function summarize(payload: DoctorPayload): { summary: string; details: string[]; nextSteps: string[] } {
  switch (payload.diagnosis) {
    case 'clean':
      return {
        summary: `Healthy ${payload.status.install_mode} peer installation detected.`,
        details: payload.peerRoot ? [`peer_root=${payload.peerRoot}`] : [],
        nextSteps: [
          'No repair is required right now.',
          'Re-run doctor after peer upgrades or manifest changes if the raw status stops being clean.',
        ],
      }
    case 'missing-peer':
      return {
        summary: `Peer package ${PEER_PACKAGE_NAME} is not discoverable from HOME=${payload.homeDir || '(unset)'}.`,
        details: [],
        nextSteps: [
          `Install ${PEER_PACKAGE_NAME} into the OpenCode plugin path, or declare its local folder in ~/.config/opencode/opencode.json(c).`,
          'Re-run doctor after the peer exists; this tool does not install or patch anything for you.',
        ],
      }
    case 'missing-emulator':
      return {
        summary: 'The emulator prerequisite is missing or not readable from the expected HOME-relative location.',
        details: [`emulator=${payload.status.emulator}`],
        nextSteps: [
          'Clone or restore not-claude-code-emulator under ~/github/not-claude-code-emulator, or point CC_CAMOUFLAGE_EMULATOR_ROOT at a readable checkout.',
          'Re-run doctor after the prerequisite is readable; this tool does not start or install the emulator for you.',
        ],
      }
    case 'unsupported':
      return {
        summary: `Platform ${payload.platform} is unsupported in v1.`,
        details: [],
        nextSteps: [
          'Run this diagnostic on a supported platform (macOS, Linux, or Windows).',
          'Do not treat unsupported-platform output as a green light for install, patch, or emulator workflows.',
        ],
      }
    case 'drift':
      return {
        summary: 'Patch preflight anchors drifted away from the pinned manifest expectation.',
        details: payload.peerRoot ? [`peer_root=${payload.peerRoot}`] : [],
        nextSteps: [
          'Inspect the peer sources against the pinned preflight checks before attempting any manual patch workflow.',
          'Reinstall or re-pin the peer package to a known compatible revision if you expected a clean state.',
        ],
      }
    case 'readonly':
      return {
        summary: `Read-only path detected at ${payload.readonlyPath}.`,
        details: payload.peerRoot ? [`peer_root=${payload.peerRoot}`] : [],
        nextSteps: [
          'Restore write access or point HOME at a writable sandbox before trying install or manual remediation steps.',
          'Re-run doctor after the environment is writable; this inspection intentionally leaves the sandbox untouched.',
        ],
      }
    case 'incompatible':
      return {
        summary: 'Patch safety cannot be confirmed from the current support, peer, or manifest state.',
        details: payload.peerRoot ? [`peer_root=${payload.peerRoot}`] : [],
        nextSteps: [
          'Verify that the supported platform, peer package, emulator prerequisite, and pinned patch metadata are all present before manual follow-up.',
          'Keep the environment unchanged until the raw status becomes either clean or a clearly actionable non-clean state.',
        ],
      }
  }
}

function formatDoctorOutput(payload: DoctorPayload): string {
  const message = summarize(payload)
  const lines = [formatStatus(payload.status), `doctor=${payload.diagnosis}`, '', message.summary]

  for (const detail of message.details) {
    lines.push(`detail: ${detail}`)
  }

  for (const nextStep of message.nextSteps) {
    lines.push(`next: ${nextStep}`)
  }

  lines.push('note: Doctor only inspected files; it did not install, patch, or touch auth/token state.')

  return lines.join('\n')
}

export function runDoctorTool(options: DetectStatusOptions = {}): DoctorResult {
  const homeDir = resolveHomeDir(options.homeDir)
  const cwd = resolveCwd(options.cwd)
  const platform = resolvePlatform(options.platform)
  const status = detectStatus({ ...options, homeDir, cwd, platform })
  const peer = discoverPeer({ homeDir, cwd })
  const support = detectSupport(platform)
  const readonlyPath = detectReadonlyPath(homeDir, peer.peer === 'present' ? peer.peerRoot : undefined)

  const payload: DoctorPayload = {
    status,
    diagnosis: 'incompatible',
    homeDir,
    platform: support.platform,
    peerRoot: peer.peer === 'present' ? peer.peerRoot : undefined,
    readonlyPath,
  }

  payload.diagnosis = diagnose(payload)

  return {
    ...payload,
    output: formatDoctorOutput(payload),
    exitCode: payload.diagnosis === 'clean' ? 0 : 1,
  }
}
