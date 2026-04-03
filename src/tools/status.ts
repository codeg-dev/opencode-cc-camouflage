import type { StatusContract } from '../contracts/status'
import { detectStatus, type DetectStatusOptions } from '../runtime/detect'

const KEYS: Array<keyof StatusContract> = [
  'peer',
  'emulator',
  'patch',
  'install_mode',
  'support',
]

export function formatStatus(status: StatusContract): string {
  return KEYS.map((key) => `${key}=${status[key]}`).join('\n')
}

export function isStatusHealthy(status: StatusContract): boolean {
  return (
    status.support === 'supported' &&
    status.peer === 'present' &&
    status.emulator === 'present' &&
    status.patch === 'clean'
  )
}

export function runStatusTool(
  options: DetectStatusOptions = {},
): { status: StatusContract; output: string; exitCode: number } {
  const status = detectStatus(options)
  const output = formatStatus(status)

  return {
    status,
    output,
    exitCode: isStatusHealthy(status) ? 0 : 1,
  }
}
