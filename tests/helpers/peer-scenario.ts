import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import { isManagedHomePath, resetManagedHome, setTreeReadOnly } from './temp-home'

export type SmokeScenario = 'missing-peer' | 'clean' | 'unsupported' | 'drift' | 'readonly'

type PrepareScenarioOptions = {
  resetHome?: boolean
}

const DRIFT_ANCHOR = "grant_type: 'refresh_token'"
const DRIFT_REPLACEMENT = 'grant_type: refreshTokenKind'
const EMULATOR_PACKAGE_NAME = 'not-claude-code-emulator'

type PatchManifest = {
  packages?: Array<{
    name?: string
    sourceFiles?: Array<{
      upstreamPath?: string
      fixturePath?: string
    }>
  }>
}

function detectScenarioFromHome(homeDir: string): SmokeScenario {
  const name = basename(homeDir)
  if (name.includes('missing-peer')) {
    return 'missing-peer'
  }
  if (name.includes('readonly')) {
    return 'readonly'
  }
  if (name.includes('unsupported')) {
    return 'unsupported'
  }
  if (name.includes('drift')) {
    return 'drift'
  }
  if (name.includes('clean') || name.includes('local-peer') || name.includes('pack')) {
    return 'clean'
  }
  return 'missing-peer'
}

async function ensureHomeLayout(homeDir: string): Promise<void> {
  await mkdir(join(homeDir, '.cache'), { recursive: true })
  await mkdir(join(homeDir, '.config', 'opencode'), { recursive: true })
  await mkdir(join(homeDir, 'github'), { recursive: true })
}

export async function writeRecognizedEmulatorRoot(root: string): Promise<string> {
  await mkdir(root, { recursive: true })
  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify({ name: EMULATOR_PACKAGE_NAME, private: true }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(join(root, 'README.md'), '# not-claude-code-emulator\n', 'utf8')
  return root
}

export async function writeUnrecognizedEmulatorRoot(root: string): Promise<string> {
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'README.md'), '# placeholder emulator root\n', 'utf8')
  return root
}

async function prepareCleanEmulatorScenario(homeDir: string): Promise<string> {
  const emulatorRoot = join(homeDir, 'github', EMULATOR_PACKAGE_NAME)
  return writeRecognizedEmulatorRoot(emulatorRoot)
}

async function prepareCleanPeerScenario(homeDir: string): Promise<{ peerRoot: string; peerIndexPath: string }> {
  const peerRoot = join(homeDir, '.config', 'opencode', 'plugins', 'opencode-anthropic-auth')
  const peerIndexPath = join(peerRoot, 'src', 'index.ts')
  const configPath = join(homeDir, '.config', 'opencode', 'opencode.json')
  const repoRoot = resolve(import.meta.dir, '..', '..')
  const manifestPath = resolve(repoRoot, 'patches', 'manifest.json')

  await mkdir(peerRoot, { recursive: true })

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PatchManifest
  const pkg = (manifest.packages ?? []).find((item) => item.name === 'opencode-anthropic-auth')
  if (!pkg?.sourceFiles?.length) {
    throw new Error('Failed to prepare clean scenario: manifest source files missing')
  }

  for (const source of pkg.sourceFiles) {
    if (!source.fixturePath || !source.upstreamPath) {
      continue
    }
    const fixturePath = resolve(repoRoot, source.fixturePath)
    const targetPath = join(peerRoot, source.upstreamPath)
    await mkdir(resolve(targetPath, '..'), { recursive: true })
    await cp(fixturePath, targetPath)
  }

  await mkdir(join(homeDir, '.config', 'opencode'), { recursive: true })
  await writeFile(
    configPath,
    JSON.stringify(
      {
        plugins: [
          {
            name: '@ex-machina/opencode-anthropic-auth',
            path: peerRoot,
          },
        ],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )

  return { peerRoot, peerIndexPath }
}

export async function prepareScenarioFromHome(
  homeDir: string,
  options: PrepareScenarioOptions = {},
): Promise<SmokeScenario> {
  const scenario = detectScenarioFromHome(homeDir)

  if (options.resetHome && isManagedHomePath(homeDir)) {
    await resetManagedHome(homeDir)
  } else {
    await ensureHomeLayout(homeDir)
  }

  if (scenario === 'missing-peer') {
    return scenario
  }

  await prepareCleanEmulatorScenario(homeDir)
  const prepared = await prepareCleanPeerScenario(homeDir)

  if (scenario === 'drift') {
    const current = await readFile(prepared.peerIndexPath, 'utf8')
    const drifted = current.replace(DRIFT_ANCHOR, DRIFT_REPLACEMENT)
    if (drifted === current) {
      throw new Error('Failed to prepare drift scenario: expected anchor not found')
    }
    await writeFile(prepared.peerIndexPath, drifted)
  }

  if (scenario === 'readonly') {
    await setTreeReadOnly(homeDir)
  }

  return scenario
}
