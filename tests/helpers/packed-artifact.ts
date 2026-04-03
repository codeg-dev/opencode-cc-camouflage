import { spawnSync } from 'node:child_process'
import { cp, lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Hooks, ToolContext } from '../../src/plugin-api'

import { prepareScenarioFromHome, type SmokeScenario } from './peer-scenario'
import { snapshotTree } from './temp-home'

type PackEntry = {
  filename: string
  files: Array<{
    path: string
  }>
}

type PreparedPackedArtifact = {
  outputDir: string
  packJsonPath: string
  tarballPath: string
  extractedPackageRoot: string
  packedFiles: string[]
}

export type PublishSafetyResult = {
  tarballPath: string
  packJsonPath: string
  packedFiles: string[]
}

type LoadedPackedPlugin = {
  createServerHooks: () => Hooks
  explicitToolIds?: readonly string[]
  pluginName?: string
  verifyOnlyCommandNote?: string
}

export type TarballSmokeResult = {
  scenario: SmokeScenario
  tarballPath: string
  packJsonPath: string
  installRoot: string
  statusOutput: string
  statusExitCode: number
  doctorOutput?: string
  doctorExitCode?: number
  warningText: string
  afterTitle: string
  afterMetadata: Record<string, unknown>
}

const repoRoot = resolve(import.meta.dir, '..', '..')
const artifactsRoot = join(repoRoot, '.artifacts', 'pack')
const tempPackRoot = join(repoRoot, '.tmp', 'pack')
const installedPluginName = 'opencode-cc-camouflage'
const expectedToolIds = ['doctor', 'patch_apply', 'patch_revert', 'status']
const requiredPackedFiles = ['LICENSE', 'NOTICE', 'package.json', 'README.md', 'patches/manifest.json'] as const
const requiredPackedDocs = [
  'docs/install.md',
  'docs/rollback.md',
  'docs/compatibility.md',
  'docs/next-release.md',
  'docs/support-matrix.md',
  'docs/non-goals.md',
  'docs/patch-inventory.md',
  'docs/upstream-locks.md',
  'docs/architecture/ownership-matrix.md',
] as const
const requiredPatchPathPrefix = 'patches/'
const patchFilePattern = /^patches\/.+\.patch$/

type ForbiddenContentCheck = {
  label: string
  test: (text: string) => boolean
}

const forbiddenContentChecks: ForbiddenContentCheck[] = [
  { label: 'managed temp path', test: (text: string) => text.includes('.tmp/home-') || text.includes('.tmp/patch-state/') },
  { label: 'auth state path', test: (text: string) => text.includes('auth.json') },
  { label: 'absolute macOS path', test: (text: string) => text.includes('/Users/') },
  { label: 'absolute Linux path', test: (text: string) => text.includes('/home/') },
  { label: 'absolute Windows path', test: (text: string) => text.includes('C:\\Users\\') },
  { label: 'bearer token marker', test: (text: string) => text.includes('Bearer ') },
  { label: 'access token marker', test: (text: string) => text.includes('access_token') },
  { label: 'token cache marker', test: (text: string) => text.includes('tokenCache') },
  { label: 'Anthropic secret prefix', test: (text: string) => text.includes('sk-ant-') },
  { label: 'generic API secret prefix', test: (text: string) => /\bsk-[A-Za-z0-9_-]{8,}/.test(text) },
] 

const patchForbiddenContentChecks = forbiddenContentChecks.filter(
  (check) =>
    check.label !== 'access token marker' &&
    check.label !== 'token cache marker',
)
  .concat({
    label: 'hardcoded bearer token marker',
    test: (text: string) => /Bearer\s+[A-Za-z0-9._-]{12,}/.test(text),
  })

function contentChecksFor(relativePath: string) {
  return patchFilePattern.test(relativePath) ? patchForbiddenContentChecks : forbiddenContentChecks
}

async function resetDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
}

function run(command: string, args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
      npm_config_yes: 'true',
    },
  })

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  }
}

async function packPublishedArtifact(label: string): Promise<PreparedPackedArtifact> {
  const outputDir = join(artifactsRoot, label)
  const extractDir = join(tempPackRoot, `${label}-extract`)
  await resetDirectory(outputDir)
  await resetDirectory(extractDir)

  const packed = run('npm', ['pack', '--json', '--pack-destination', outputDir], repoRoot)
  if (packed.status !== 0) {
    throw new Error(`npm pack failed (${packed.status}): ${packed.stderr || packed.stdout}`)
  }

  const parsed = JSON.parse(packed.stdout) as PackEntry[]
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error('npm pack did not return a single artifact record')
  }

  const [entry] = parsed
  if (!entry?.filename) {
    throw new Error('npm pack did not report a tarball filename')
  }

  const packJsonPath = join(outputDir, 'pack.json')
  await writeFile(packJsonPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

  const tarballPath = join(outputDir, entry.filename)
  const extracted = run('tar', ['-xzf', tarballPath, '-C', extractDir], repoRoot)
  if (extracted.status !== 0) {
    throw new Error(`tar extraction failed (${extracted.status}): ${extracted.stderr || extracted.stdout}`)
  }

  const extractedPackageRoot = join(extractDir, 'package')
  if (!existsSync(extractedPackageRoot)) {
    throw new Error('Packed tarball did not extract a package/ directory')
  }

  return {
    outputDir,
    packJsonPath,
    tarballPath,
    extractedPackageRoot,
    packedFiles: (entry.files ?? []).map((file) => file.path),
  }
}

async function collectRelativeFiles(root: string, current: string, output: string[]): Promise<void> {
  const stat = await lstat(current)
  if (stat.isDirectory()) {
    const entries = (await readdir(current)).sort()
    for (const entry of entries) {
      await collectRelativeFiles(root, join(current, entry), output)
    }
    return
  }

  output.push(relative(root, current))
}

async function assertPackedArtifactSafety(artifact: PreparedPackedArtifact): Promise<void> {
  for (const packedFile of artifact.packedFiles) {
    const isReadme = /^README(?:\.[^.]+)?\.md$/.test(packedFile)
    const isPatchManifest = packedFile === 'patches/manifest.json'
    const isPatchFile = patchFilePattern.test(packedFile)
    const isDoc = packedFile.startsWith('docs/')
    const allowed =
      packedFile === 'LICENSE' ||
      packedFile === 'NOTICE' ||
      packedFile === 'package.json' ||
      isReadme ||
      isDoc ||
      packedFile.startsWith('dist/') ||
      isPatchManifest ||
      isPatchFile
    if (!allowed) {
      throw new Error(`Packed artifact included non-publish-safe path: ${packedFile}`)
    }

    if (
        packedFile.startsWith('.tmp/') ||
        packedFile.startsWith('tests/') ||
        packedFile.startsWith('src/') ||
        packedFile.startsWith('fixtures/') ||
        packedFile.startsWith('.artifacts/')
      ) {
        throw new Error(`Packed artifact leaked forbidden path: ${packedFile}`)
      }

    if (packedFile.startsWith('patches/') && !isPatchManifest && !isPatchFile) {
      throw new Error(`Packed artifact leaked forbidden path inside patches/: ${packedFile}`)
    }
  }

  const extractedFiles: string[] = []
  await collectRelativeFiles(artifact.extractedPackageRoot, artifact.extractedPackageRoot, extractedFiles)

  for (const relativePath of extractedFiles) {
    if (relativePath.includes('.tmp/') || relativePath.includes('fixtures/') || relativePath.includes('auth.json')) {
      throw new Error(`Extracted tarball leaked forbidden file path: ${relativePath}`)
    }

    const content = await readFile(join(artifact.extractedPackageRoot, relativePath))
    if (content.includes(0)) {
      continue
    }

    const text = content.toString('utf8')
    if (!relativePath.startsWith('docs/') && relativePath !== 'patches/manifest.json' && text.includes('fixtures/upstream/')) {
      throw new Error(`Packed file ${relativePath} leaked forbidden fixture path reference`)
    }

    if (!relativePath.startsWith('docs/')) {
      for (const check of contentChecksFor(relativePath)) {
      if (check.test(text)) {
        throw new Error(`Packed file ${relativePath} leaked forbidden ${check.label}`)
      }
    }
    }
  }
}

function assertRequiredPackedFiles(artifact: PreparedPackedArtifact): void {
  const missingFiles: string[] = [...requiredPackedFiles.filter((requiredFile) => !artifact.packedFiles.includes(requiredFile))]
  for (const requiredDoc of requiredPackedDocs) {
    if (!artifact.packedFiles.includes(requiredDoc)) {
      missingFiles.push(requiredDoc)
    }
  }
  const missingPatchFile = !artifact.packedFiles.some((packedFile) => patchFilePattern.test(packedFile))
  if (missingPatchFile) {
    missingFiles.push(`${requiredPatchPathPrefix}*.patch`)
  }

  if (missingFiles.length > 0) {
    throw new Error(`Packed artifact missing required file(s): ${missingFiles.join(', ')}`)
  }
}

export async function runPublishSafetyCheck(label: string): Promise<PublishSafetyResult> {
  const artifact = await packPublishedArtifact(label)
  await assertPackedArtifactSafety(artifact)
  assertRequiredPackedFiles(artifact)

  return {
    tarballPath: artifact.tarballPath,
    packJsonPath: artifact.packJsonPath,
    packedFiles: [...artifact.packedFiles],
  }
}

async function linkRuntimeDependencies(installRoot: string): Promise<void> {
  const packageJsonPath = join(installRoot, 'package.json')
  const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>
  }

  for (const dependencyName of Object.keys(pkg.dependencies ?? {})) {
    const source = join(repoRoot, 'node_modules', ...dependencyName.split('/'))
    if (!existsSync(source)) {
      throw new Error(`Local dependency missing for tarball smoke: ${dependencyName}`)
    }

    const target = join(installRoot, 'node_modules', ...dependencyName.split('/'))
    await rm(target, { recursive: true, force: true })
    await mkdir(dirname(target), { recursive: true })
    await symlink(source, target, 'dir')
  }
}

async function installPackedPlugin(artifact: PreparedPackedArtifact, homeDir: string): Promise<string> {
  const installRoot = join(homeDir, '.config', 'opencode', 'plugins', installedPluginName)
  await rm(installRoot, { recursive: true, force: true })
  await mkdir(dirname(installRoot), { recursive: true })
  await cp(artifact.extractedPackageRoot, installRoot, { recursive: true })
  await linkRuntimeDependencies(installRoot)
  return installRoot
}

async function registerInstalledPlugin(homeDir: string, installRoot: string): Promise<void> {
  const configPath = join(homeDir, '.config', 'opencode', 'opencode.json')
  const current = existsSync(configPath)
    ? (JSON.parse(await readFile(configPath, 'utf8')) as { plugins?: Array<Record<string, unknown>> })
    : {}

  const plugins = Array.isArray(current.plugins) ? [...current.plugins] : []
  const alreadyRegistered = plugins.some(
    (plugin) => plugin.name === installedPluginName || plugin.path === installRoot,
  )

  if (!alreadyRegistered) {
    plugins.push({
      name: installedPluginName,
      path: installRoot,
    })
  }

  await writeFile(configPath, `${JSON.stringify({ ...current, plugins }, null, 2)}\n`, 'utf8')
}

function createToolContext(directory: string) {
  const metadataCalls: Array<Parameters<ToolContext['metadata']>[0]> = []

  const context: ToolContext = {
    sessionID: `ses-packed-${basename(directory)}`,
    messageID: `msg-packed-${basename(directory)}`,
    agent: 'build',
    directory,
    worktree: directory,
    abort: new AbortController().signal,
    metadata(input) {
      metadataCalls.push(input)
    },
    async ask() {},
  }

  return { context, metadataCalls }
}

function readExitCode(metadataCalls: Array<Parameters<ToolContext['metadata']>[0]>): number {
  const lastCall = metadataCalls.at(-1)
  const exitCode = lastCall?.metadata?.exitCode
  if (typeof exitCode !== 'number') {
    throw new Error('Tool metadata did not include an exitCode')
  }
  return exitCode
}

async function loadInstalledPlugin(installRoot: string, cacheKey: string): Promise<LoadedPackedPlugin> {
  const entryPath = join(installRoot, 'dist', 'index.js')
  const url = `${pathToFileURL(entryPath).href}?cacheKey=${encodeURIComponent(cacheKey)}`
  const loaded = (await import(url)) as Partial<LoadedPackedPlugin>

  if (typeof loaded.createServerHooks !== 'function') {
    throw new Error('Packed plugin did not export createServerHooks()')
  }

  return loaded as LoadedPackedPlugin
}

export async function runTarballSmoke(homeDir: string): Promise<TarballSmokeResult> {
  const originalFallbackPaths = process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
  process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = '~/github/not-claude-code-emulator'

  try {
  const scenario = await prepareScenarioFromHome(homeDir, { resetHome: true })
  const label = basename(homeDir)
  const artifact = await packPublishedArtifact(label)
  await assertPackedArtifactSafety(artifact)
  assertRequiredPackedFiles(artifact)

  const installRoot = await installPackedPlugin(artifact, homeDir)
  await registerInstalledPlugin(homeDir, installRoot)

  const authPath = join(homeDir, '.config', 'opencode', 'auth.json')
  await writeFile(authPath, `${JSON.stringify({ access: 'token', refresh: 'secret' }, null, 2)}\n`, 'utf8')
  const beforeSnapshot = await snapshotTree(homeDir)

  const loaded = await loadInstalledPlugin(installRoot, `${label}-${Date.now()}`)
  if (loaded.pluginName !== installedPluginName) {
    throw new Error(`Packed plugin name mismatch: ${loaded.pluginName ?? '<missing>'}`)
  }

  const toolIds = [...(loaded.explicitToolIds ?? [])].sort()
  if (JSON.stringify(toolIds) !== JSON.stringify(expectedToolIds)) {
    throw new Error(`Packed explicitToolIds drifted: ${toolIds.join(',')}`)
  }

  const hooks = loaded.createServerHooks()
  if (!hooks.tool?.status || !hooks.tool.doctor) {
    throw new Error('Packed plugin did not register status and doctor tools')
  }
  if (!hooks['command.execute.before'] || !hooks['tool.execute.after']) {
    throw new Error('Packed plugin did not expose verify-only hooks')
  }
  if (hooks['experimental.chat.system.transform']) {
    throw new Error('Packed plugin unexpectedly exposed experimental.chat.system.transform')
  }

  const warningOutput: Parameters<NonNullable<Hooks['command.execute.before']>>[1] = { parts: [] }
  await hooks['command.execute.before'](
      { command: 'patch_apply', sessionID: `ses-${label}`, arguments: '' },
    warningOutput,
  )

  const warningText = warningOutput.parts[0]?.type === 'text' ? warningOutput.parts[0].text : ''
  if (!warningText || warningText !== loaded.verifyOnlyCommandNote) {
    throw new Error('Packed command.execute.before warning drifted')
  }

  const { context: statusContext, metadataCalls: statusMetadataCalls } = createToolContext(installRoot)
  const statusOutput = await hooks.tool.status.execute({ homeDir, cwd: installRoot }, statusContext)
  const statusExitCode = readExitCode(statusMetadataCalls)

  const afterOutput: Parameters<NonNullable<Hooks['tool.execute.after']>>[1] = {
    title: '',
    output: statusOutput,
    metadata: { existing: true },
  }
  await hooks['tool.execute.after'](
    { tool: 'status', sessionID: `ses-${label}`, callID: `call-${label}`, args: {} },
    afterOutput,
  )

  const afterTitle = afterOutput.title ?? ''
  if (afterTitle !== 'Camouflage Status') {
    throw new Error(`Packed tool.execute.after title drifted: ${afterTitle || '<empty>'}`)
  }

  const afterMetadata =
    afterOutput.metadata && typeof afterOutput.metadata === 'object' && !Array.isArray(afterOutput.metadata)
      ? { ...afterOutput.metadata }
      : {}
  if (afterMetadata.plugin !== installedPluginName || afterMetadata.verifyOnly !== true || afterMetadata.mutated !== false) {
    throw new Error('Packed tool.execute.after metadata drifted')
  }

  let doctorOutput: string | undefined
  let doctorExitCode: number | undefined
  if (statusExitCode === 0) {
    const { context: doctorContext, metadataCalls: doctorMetadataCalls } = createToolContext(installRoot)
    doctorOutput = await hooks.tool.doctor.execute({ homeDir, cwd: installRoot }, doctorContext)
    doctorExitCode = readExitCode(doctorMetadataCalls)
  }

  const afterSnapshot = await snapshotTree(homeDir)
  if (afterSnapshot !== beforeSnapshot) {
    throw new Error('Packed verify-only smoke mutated HOME state')
  }

  return {
    scenario,
    tarballPath: artifact.tarballPath,
    packJsonPath: artifact.packJsonPath,
    installRoot,
    statusOutput,
    statusExitCode,
    doctorOutput,
    doctorExitCode,
    warningText,
    afterTitle,
    afterMetadata,
  }
  } finally {
    if (originalFallbackPaths === undefined) {
      delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
    } else {
      process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = originalFallbackPaths
    }
  }
}
