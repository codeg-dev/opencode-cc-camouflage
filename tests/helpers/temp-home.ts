import { createHash } from 'node:crypto'
import { chmod, lstat, mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

type CreateTempHomeOptions = {
  homeSuffix?: string
}

export type TempHomeFixture = {
  root: string
  cacheDir: string
  configDir: string
  cleanup: () => Promise<void>
}

const repoRoot = resolve(import.meta.dir, '..', '..')
const repoTmpRoot = join(repoRoot, '.tmp')

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}

async function setTreeMode(
  root: string,
  directoryMode: number,
  fileMode: number,
  directoriesFirst: boolean,
): Promise<void> {
  if (!(await pathExists(root))) {
    return
  }

  const stat = await lstat(root)
  if (stat.isDirectory()) {
    if (directoriesFirst) {
      await chmod(root, directoryMode).catch(() => {})
    }

    const entries = await readdir(root)
    for (const entry of entries) {
      await setTreeMode(join(root, entry), directoryMode, fileMode, directoriesFirst)
    }

    if (!directoriesFirst) {
      await chmod(root, directoryMode).catch(() => {})
    }
    return
  }

  await chmod(root, fileMode).catch(() => {})
}

async function makeTreeWritable(root: string): Promise<void> {
  await setTreeMode(root, 0o755, 0o644, true)
}

async function removeTree(root: string): Promise<void> {
  await makeTreeWritable(root)
  await rm(root, { recursive: true, force: true })
}

async function ensureBaseLayout(root: string): Promise<void> {
  await mkdir(join(root, '.cache'), { recursive: true })
  await mkdir(join(root, '.config', 'opencode'), { recursive: true })
}

function formatMode(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, '0')
}

async function collectSnapshot(root: string, current: string, lines: string[]): Promise<void> {
  const stat = await lstat(current)
  const rel = relative(root, current) || '.'

  if (stat.isDirectory()) {
    lines.push(`${rel}/ mode=${formatMode(stat.mode)}`)
    const entries = (await readdir(current)).sort()
    for (const entry of entries) {
      await collectSnapshot(root, join(current, entry), lines)
    }
    return
  }

  if (stat.isFile()) {
    const digest = createHash('sha256').update(await readFile(current)).digest('hex')
    lines.push(`${rel} mode=${formatMode(stat.mode)} sha256=${digest}`)
    return
  }

  lines.push(`${rel} type=other`)
}

export async function createTempHome(
  options: CreateTempHomeOptions = {},
): Promise<TempHomeFixture> {
  const stamp = options.homeSuffix?.trim() || 'opencode-cc-camouflage'
  const root = await mkdtemp(join(tmpdir(), `${stamp}-`))

  const cacheDir = join(root, '.cache')
  const configDir = join(root, '.config', 'opencode')

  await ensureBaseLayout(root)

  return {
    root,
    cacheDir,
    configDir,
    cleanup: async () => {
      await removeTree(root)
    },
  }
}

export function createHomedirStubEnv(
  homeDir: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    HOME: homeDir,
    USERPROFILE: homeDir,
  }

  const windowsPathMatch = homeDir.match(/^([A-Za-z]:)([\\/].*)$/)
  if (windowsPathMatch) {
    env.HOMEDRIVE = windowsPathMatch[1]
    env.HOMEPATH = windowsPathMatch[2]
  }

  return env
}

export function isManagedHomePath(homeDir: string): boolean {
  const resolved = resolve(homeDir)
  return resolved === repoTmpRoot || resolved.startsWith(`${repoTmpRoot}/`)
}

export async function resetManagedHome(homeDir: string): Promise<void> {
  if (!isManagedHomePath(homeDir)) {
    throw new Error(`Managed home must stay under ${repoTmpRoot}`)
  }

  const resolvedHome = resolve(homeDir)
  await removeTree(resolvedHome)
  await ensureBaseLayout(resolvedHome)
}

export async function removeManagedHome(homeDir: string): Promise<void> {
  if (!isManagedHomePath(homeDir)) {
    throw new Error(`Managed home must stay under ${repoTmpRoot}`)
  }

  await removeTree(resolve(homeDir))
}

export async function setTreeReadOnly(root: string): Promise<void> {
  await setTreeMode(root, 0o555, 0o444, false)
}

export async function snapshotTree(root: string): Promise<string> {
  if (!(await pathExists(root))) {
    return '<missing>'
  }

  const lines: string[] = []
  await collectSnapshot(root, root, lines)
  return lines.join('\n')
}
