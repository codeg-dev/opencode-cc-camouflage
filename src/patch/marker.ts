import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TARGET_PACKAGE = 'opencode-anthropic-auth'

export type MarkerState = {
  packageName: string
  peerRoot: string
  patchSha256: string
  appliedAt: string
}

export function markerPathForRepo(repoRoot: string): string {
  return resolve(repoRoot, '.tmp', 'patch-state', `${TARGET_PACKAGE}.json`)
}

export function readMarker(path: string): MarkerState | undefined {
  if (!existsSync(path)) {
    return undefined
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as MarkerState
    if (
      parsed.packageName !== TARGET_PACKAGE ||
      typeof parsed.peerRoot !== 'string' ||
      typeof parsed.patchSha256 !== 'string'
    ) {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

export function writeMarker(path: string, value: MarkerState): void {
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function removeMarker(path: string): void {
  rmSync(path, { force: true })
}
