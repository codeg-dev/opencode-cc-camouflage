import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type ManifestSourceFile = {
  upstreamPath: string
  fixturePath: string
  sha256: string
}

export type ManifestTargetCheck = {
  targetPath: string
  fallbackPath?: string
  contains: string
}

export type ManifestPatchFile = {
  path: string
  sha256: string
}

export type ManifestPackage = {
  name: string
  upstream: { repo: string; sha: string }
  sourceFiles: ManifestSourceFile[]
  preflightTargetChecks: ManifestTargetCheck[]
  patchFiles: ManifestPatchFile[]
  rollbackMarkerNaming: string
}

type ManifestDoc = {
  schemaVersion: number
  packages?: ManifestPackage[]
}

export type LoadedManifestPackage = {
  repoRoot: string
  manifestPath: string
  packageSpec: ManifestPackage
  patchPath: string
  patchSha256: string
}

export function sha256File(path: string): string {
  try {
    const value = readFileSync(path)
    return createHash('sha256').update(value).digest('hex')
  } catch (err) {
    throw new Error(`sha256File: failed to read ${path}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function resolveRepoRoot(repoRoot?: string): string {
  return repoRoot ?? resolve(import.meta.dir, '..', '..')
}

export function loadManifestPackage(
  packageName: string,
  options: { repoRoot?: string } = {},
): LoadedManifestPackage | undefined {
  const root = resolveRepoRoot(options.repoRoot)
  const manifestPath = resolve(root, 'patches', 'manifest.json')
  if (!existsSync(manifestPath)) {
    return undefined
  }

  let manifest: ManifestDoc
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestDoc
  } catch {
    return undefined
  }

  if (manifest.schemaVersion !== 1) {
    return undefined
  }

  const packageSpec = (manifest.packages ?? []).find((item) => item.name === packageName)
  if (!packageSpec) {
    return undefined
  }

  if (!Array.isArray(packageSpec.patchFiles) || packageSpec.patchFiles.length !== 1) {
    return undefined
  }

  const [patchSpec] = packageSpec.patchFiles
  if (!patchSpec || !patchSpec.path || !patchSpec.sha256) {
    return undefined
  }

  const patchPath = resolve(root, patchSpec.path)
  if (!existsSync(patchPath)) {
    return undefined
  }

  return {
    repoRoot: root,
    manifestPath,
    packageSpec,
    patchPath,
    patchSha256: patchSpec.sha256,
  }
}
