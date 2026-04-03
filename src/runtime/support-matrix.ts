import type { SupportStatus } from '../contracts/status'

const SUPPORTED_PLATFORMS = new Set(['darwin', 'linux', 'win32'])

export interface SupportCheckResult {
  support: SupportStatus
  platform: string
}

export function detectSupport(platform: string = process.platform): SupportCheckResult {
  return {
    support: SUPPORTED_PLATFORMS.has(platform) ? 'supported' : 'unsupported',
    platform,
  }
}
