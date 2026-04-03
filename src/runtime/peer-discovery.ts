import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import type { InstallMode, PeerStatus } from '../contracts/status'

const PEER_PACKAGE_NAME = '@ex-machina/opencode-anthropic-auth'
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/

export interface PeerDiscoveryResult {
  peer: PeerStatus
  install_mode: InstallMode
  peerRoot?: string
}

interface DiscoverPeerOptions {
  homeDir?: string
  cwd?: string
}

function stripJsonComments(raw: string): string {
  let output = ''
  let inString = false
  let stringQuote = ''
  let escaping = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index]
    const next = raw[index + 1]

    if (inLineComment) {
      if (current === '\n') {
        inLineComment = false
        output += current
      }
      continue
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        inBlockComment = false
        index += 1
        continue
      }

      if (current === '\n') {
        output += current
      }
      continue
    }

    if (inString) {
      output += current
      if (escaping) {
        escaping = false
        continue
      }

      if (current === '\\') {
        escaping = true
        continue
      }

      if (current === stringQuote) {
        inString = false
        stringQuote = ''
      }
      continue
    }

    if (current === '"' || current === "'") {
      inString = true
      stringQuote = current
      output += current
      continue
    }

    if (current === '/' && next === '/') {
      inLineComment = true
      index += 1
      continue
    }

    if (current === '/' && next === '*') {
      inBlockComment = true
      index += 1
      continue
    }

    output += current
  }

  return output
}

function parseJsonWithComments(path: string): unknown {
  if (!existsSync(path)) {
    return undefined
  }

  const raw = readFileSync(path, 'utf8')
  const stripped = stripJsonComments(raw)

  try {
    return JSON.parse(stripped)
  } catch {
    return undefined
  }
}

function classifyInstallMode(path: string): InstallMode {
  const normalizedPath = path.replace(/\\/g, '/').toLowerCase()
  return normalizedPath.includes('/node_modules/') ? 'cache' : 'local-folder'
}

function normalizePeerRoot(candidate: string): string | undefined {
  const directPackageJson = join(candidate, 'package.json')
  if (existsSync(directPackageJson)) {
    try {
      const parsed = JSON.parse(readFileSync(directPackageJson, 'utf8')) as {
        name?: string
      }
      if (parsed.name === PEER_PACKAGE_NAME) {
        return candidate
      }
    } catch {
      return undefined
    }
  }

  const nestedPackageRoot = join(candidate, 'node_modules', ...PEER_PACKAGE_NAME.split('/'))
  const nestedPackageJson = join(nestedPackageRoot, 'package.json')
  if (existsSync(nestedPackageJson)) {
    try {
      const parsed = JSON.parse(readFileSync(nestedPackageJson, 'utf8')) as {
        name?: string
      }
      if (parsed.name === PEER_PACKAGE_NAME) {
        return nestedPackageRoot
      }
    } catch {
      return undefined
    }
  }

  return undefined
}

function looksLikePath(value: string): boolean {
  return (
    value.startsWith('/') ||
    value.startsWith('~') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('\\\\') ||
    WINDOWS_DRIVE_PATH_PATTERN.test(value)
  )
}

export function classifyInstallModeForTests(path: string): InstallMode {
  return classifyInstallMode(path)
}

export function looksLikePathForTests(value: string): boolean {
  return looksLikePath(value)
}

function collectDeclaredPaths(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectDeclaredPaths(item, output)
    }
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  const record = value as Record<string, unknown>
  const idLike = [record.name, record.package, record.id]
    .filter((v): v is string => typeof v === 'string')
    .some((v) => v.includes(PEER_PACKAGE_NAME) || v.includes('opencode-anthropic-auth'))

  if (idLike) {
    for (const key of ['path', 'dir', 'directory', 'location', 'source']) {
      const pathValue = record[key]
      if (typeof pathValue === 'string' && pathValue.trim().length > 0) {
        output.add(pathValue.trim())
      }
    }
  }

  for (const [key, nested] of Object.entries(record)) {
    if (
      typeof nested === 'string' &&
      looksLikePath(nested) &&
      (nested.includes(PEER_PACKAGE_NAME) ||
        nested.includes('opencode-anthropic-auth') ||
        key.toLowerCase().includes('plugin'))
    ) {
      output.add(nested.trim())
    } else {
      collectDeclaredPaths(nested, output)
    }
  }
}

function discoverFromConfig(homeDir: string): PeerDiscoveryResult | undefined {
  const configCandidates = [
    join(homeDir, '.config', 'opencode', 'opencode.json'),
    join(homeDir, '.config', 'opencode', 'opencode.jsonc'),
  ]

  for (const configPath of configCandidates) {
    const parsed = parseJsonWithComments(configPath)
    if (!parsed) {
      continue
    }

    const declared = new Set<string>()
    collectDeclaredPaths(parsed, declared)

    for (const rawPath of declared) {
      const absolutePath = resolve(homeDir, rawPath.replace(/^~[/\\]/, ''))
      const peerRoot = normalizePeerRoot(absolutePath)
      if (peerRoot) {
        return {
          peer: 'present',
          install_mode: classifyInstallMode(peerRoot),
          peerRoot,
        }
      }
    }
  }

  return undefined
}

export function discoverPeer(options: DiscoverPeerOptions = {}): PeerDiscoveryResult {
  const homeDir = options.homeDir ?? homedir()
  const cwd = options.cwd ?? process.cwd()

  const fromConfig = discoverFromConfig(homeDir)
  if (fromConfig) {
    return fromConfig
  }

  const heuristicCandidates = [
    join(cwd, 'node_modules', ...PEER_PACKAGE_NAME.split('/')),
    join(homeDir, '.config', 'opencode', 'plugins', 'opencode-anthropic-auth'),
    join(homeDir, '.local', 'share', 'opencode', 'node_modules', ...PEER_PACKAGE_NAME.split('/')),
    join(homeDir, '.cache', 'opencode', 'node_modules', ...PEER_PACKAGE_NAME.split('/')),
  ]

  for (const candidate of heuristicCandidates) {
    const peerRoot = normalizePeerRoot(candidate)
    if (peerRoot) {
      return {
        peer: 'present',
        install_mode: classifyInstallMode(peerRoot),
        peerRoot,
      }
    }
  }

  return {
    peer: 'missing',
    install_mode: 'unknown',
  }
}
