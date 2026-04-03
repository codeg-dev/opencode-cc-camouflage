import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

import { loadManifestPackage, resolveRepoRoot } from './manifest'

const TARGET_PACKAGE = 'opencode-anthropic-auth'
const DRIFT_REPLACEMENT = 'grant_type: refreshTokenKind'

type SandboxScenario = 'missing-peer' | 'clean' | 'drift'

function detectScenario(homeDir: string): SandboxScenario {
  const name = basename(homeDir)
  if (name.includes('missing-peer')) {
    return 'missing-peer'
  }
  if (name.includes('drift')) {
    return 'drift'
  }
  if (name.includes('clean') || name.includes('local-peer') || name.includes('pack')) {
    return 'clean'
  }
  return 'missing-peer'
}

function isManagedSandboxHome(homeDir: string, repoRoot: string): boolean {
  const managedRoot = resolve(repoRoot, '.tmp')
  const resolvedHome = resolve(homeDir)
  return resolvedHome.startsWith(`${managedRoot}/`)
}

function ensureBaseLayout(homeDir: string): void {
  mkdirSync(join(homeDir, '.cache'), { recursive: true })
  mkdirSync(join(homeDir, '.config', 'opencode'), { recursive: true })
}

function ensureConfig(homeDir: string, peerRoot: string): void {
  const configPath = join(homeDir, '.config', 'opencode', 'opencode.json')
  const config = {
    plugins: [{ name: '@ex-machina/opencode-anthropic-auth', path: peerRoot }],
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function ensurePeerRoot(peerRoot: string): void {
  mkdirSync(peerRoot, { recursive: true })
}

export function prepareManagedPatchSandbox(options: { homeDir?: string; repoRoot?: string }): void {
  const homeDir = options.homeDir ?? homedir()
  if (!homeDir) {
    return
  }

  const repoRoot = resolveRepoRoot(options.repoRoot)
  if (!isManagedSandboxHome(homeDir, repoRoot)) {
    return
  }

  ensureBaseLayout(homeDir)
  const scenario = detectScenario(homeDir)
  if (scenario === 'missing-peer') {
    return
  }

  const manifest = loadManifestPackage(TARGET_PACKAGE, { repoRoot })
  if (!manifest) {
    return
  }

  const peerRoot = join(homeDir, '.config', 'opencode', 'plugins', TARGET_PACKAGE)
  const hasPreparedPeer = existsSync(join(peerRoot, 'package.json')) && existsSync(join(peerRoot, 'src', 'index.ts'))
  ensurePeerRoot(peerRoot)
  ensureConfig(homeDir, peerRoot)

  if (hasPreparedPeer) {
    return
  }

  for (const source of manifest.packageSpec.sourceFiles) {
    const from = resolve(repoRoot, source.fixturePath)
    const to = resolve(peerRoot, source.upstreamPath)
    if (!existsSync(from)) {
      continue
    }
    mkdirSync(resolve(to, '..'), { recursive: true })
    cpSync(from, to)
  }

  if (scenario !== 'drift') {
    return
  }

  const [firstCheck] = manifest.packageSpec.preflightTargetChecks
  if (!firstCheck?.targetPath || !firstCheck.contains) {
    return
  }

  const driftTarget = resolve(peerRoot, firstCheck.targetPath)
  if (!existsSync(driftTarget)) {
    return
  }

  const original = readFileSync(driftTarget, 'utf8')
  const drifted = original.replace(firstCheck.contains, DRIFT_REPLACEMENT)
  if (drifted !== original) {
    writeFileSync(driftTarget, drifted, 'utf8')
  }
}
