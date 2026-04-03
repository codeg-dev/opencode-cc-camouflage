#!/usr/bin/env bun
/**
 * Compatibility Canary
 *
 * A read-only check that validates fixture integrity and upstream references
 * without mutating anything. Exits 0 on pinned supported targets.
 */

import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

interface ManifestFile {
  upstreamPath: string
  fixturePath: string
  sha256: string
}

interface ManifestPackage {
  name: string
  upstream: {
    repo: string
    sha: string
  }
  fixtureRoot: string
  sourceFiles: ManifestFile[]
}

interface ReferenceFixture {
  name: string
  upstream: {
    repo: string
    sha: string
  }
  files: ManifestFile[]
}

interface Manifest {
  schemaVersion: number
  packages: ManifestPackage[]
  referenceFixtures?: ReferenceFixture[]
}

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const MANIFEST_PATH = resolve(PROJECT_ROOT, 'patches', 'manifest.json')

const SUPPORT_MATRIX = {
  platforms: ['darwin', 'linux'],
  upstreams: {
    'not-claude-code-emulator': '5541e5c1cb0895cfd4390391dc642c74fc5d0a1a',
    'opencode-anthropic-auth': '6594dd1f1ff8b63342f83173d4477f8b549b4867',
  },
}

function sha256File(path: string): string {
  const content = readFileSync(path)
  return createHash('sha256').update(content).digest('hex')
}

function loadManifest(): Manifest {
  const content = readFileSync(MANIFEST_PATH, 'utf-8')
  return JSON.parse(content) as Manifest
}

interface CheckResult {
  name: string
  passed: boolean
  message: string
}

function checkPlatform(): CheckResult {
  const platform = process.platform
  const supported = SUPPORT_MATRIX.platforms.includes(platform)
  return {
    name: 'platform-support',
    passed: supported,
    message: supported
      ? `Platform ${platform} is supported`
      : `Platform ${platform} is not supported (expected: ${SUPPORT_MATRIX.platforms.join(', ')})`,
  }
}

function checkManifestExists(): CheckResult {
  const exists = existsSync(MANIFEST_PATH)
  return {
    name: 'manifest-exists',
    passed: exists,
    message: exists ? 'Manifest file exists' : `Manifest not found at ${MANIFEST_PATH}`,
  }
}

function checkManifestValid(manifest: Manifest | null): CheckResult {
  if (!manifest) {
    return {
      name: 'manifest-valid',
      passed: false,
      message: 'Manifest could not be loaded',
    }
  }

  const hasPackages = Array.isArray(manifest.packages) && manifest.packages.length > 0
  const hasSchema = manifest.schemaVersion === 1

  return {
    name: 'manifest-valid',
    passed: hasPackages && hasSchema,
    message: hasPackages && hasSchema
      ? 'Manifest structure is valid'
      : `Invalid manifest: schema=${manifest.schemaVersion}, packages=${manifest.packages?.length ?? 0}`,
  }
}

function checkFixturesExist(manifest: Manifest): CheckResult[] {
  const results: CheckResult[] = []

  for (const pkg of manifest.packages) {
    for (const file of pkg.sourceFiles) {
      const fullPath = resolve(PROJECT_ROOT, file.fixturePath)
      const exists = existsSync(fullPath)
      results.push({
        name: `fixture-exists:${pkg.name}:${file.upstreamPath}`,
        passed: exists,
        message: exists
          ? `Fixture exists: ${file.fixturePath}`
          : `Fixture missing: ${file.fixturePath}`,
      })
    }
  }

  // Check reference fixtures
  for (const ref of manifest.referenceFixtures ?? []) {
    for (const file of ref.files) {
      const fullPath = resolve(PROJECT_ROOT, file.fixturePath)
      const exists = existsSync(fullPath)
      results.push({
        name: `fixture-exists:${ref.name}:${file.upstreamPath}`,
        passed: exists,
        message: exists
          ? `Reference fixture exists: ${file.fixturePath}`
          : `Reference fixture missing: ${file.fixturePath}`,
      })
    }
  }

  return results
}

function checkFixtureHashes(manifest: Manifest): CheckResult[] {
  const results: CheckResult[] = []

  for (const pkg of manifest.packages) {
    for (const file of pkg.sourceFiles) {
      const fullPath = resolve(PROJECT_ROOT, file.fixturePath)
      if (!existsSync(fullPath)) {
        results.push({
          name: `fixture-hash:${pkg.name}:${file.upstreamPath}`,
          passed: false,
          message: `Cannot hash missing fixture: ${file.fixturePath}`,
        })
        continue
      }

      const actualHash = sha256File(fullPath)
      const matches = actualHash === file.sha256
      results.push({
        name: `fixture-hash:${pkg.name}:${file.upstreamPath}`,
        passed: matches,
        message: matches
          ? `Hash matches for ${file.upstreamPath}`
          : `Hash mismatch for ${file.upstreamPath}: expected ${file.sha256}, got ${actualHash}`,
      })
    }
  }

  // Check reference fixture hashes
  for (const ref of manifest.referenceFixtures ?? []) {
    for (const file of ref.files) {
      const fullPath = resolve(PROJECT_ROOT, file.fixturePath)
      if (!existsSync(fullPath)) {
        results.push({
          name: `fixture-hash:${ref.name}:${file.upstreamPath}`,
          passed: false,
          message: `Cannot hash missing reference fixture: ${file.fixturePath}`,
        })
        continue
      }

      const actualHash = sha256File(fullPath)
      const matches = actualHash === file.sha256
      results.push({
        name: `fixture-hash:${ref.name}:${file.upstreamPath}`,
        passed: matches,
        message: matches
          ? `Reference hash matches for ${file.upstreamPath}`
          : `Reference hash mismatch for ${file.upstreamPath}: expected ${file.sha256}, got ${actualHash}`,
      })
    }
  }

  return results
}

function checkUpstreamLocks(manifest: Manifest): CheckResult[] {
  const results: CheckResult[] = []

  for (const [expectedName, expectedSha] of Object.entries(SUPPORT_MATRIX.upstreams)) {
    // Check in packages
    const pkg = manifest.packages.find(p => p.name === expectedName)
    if (pkg) {
      const matches = pkg.upstream.sha === expectedSha
      results.push({
        name: `upstream-lock:${expectedName}`,
        passed: matches,
        message: matches
          ? `Upstream ${expectedName} is locked to ${expectedSha}`
          : `Upstream ${expectedName} SHA mismatch: expected ${expectedSha}, got ${pkg.upstream.sha}`,
      })
      continue
    }

    // Check in reference fixtures
    const ref = manifest.referenceFixtures?.find(r => r.name === expectedName)
    if (ref) {
      const matches = ref.upstream.sha === expectedSha
      results.push({
        name: `upstream-lock:${expectedName}`,
        passed: matches,
        message: matches
          ? `Reference ${expectedName} is locked to ${expectedSha}`
          : `Reference ${expectedName} SHA mismatch: expected ${expectedSha}, got ${ref.upstream.sha}`,
      })
      continue
    }

    results.push({
      name: `upstream-lock:${expectedName}`,
      passed: false,
      message: `Upstream ${expectedName} not found in manifest`,
    })
  }

  return results
}

function runAllChecks(): CheckResult[] {
  const results: CheckResult[] = []

  // Basic checks
  results.push(checkPlatform())
  results.push(checkManifestExists())

  let manifest: Manifest | null = null
  try {
    manifest = loadManifest()
  } catch {
    // Manifest load failure will be reported by checkManifestValid
  }

  results.push(checkManifestValid(manifest))

  if (manifest) {
    results.push(...checkFixturesExist(manifest))
    results.push(...checkFixtureHashes(manifest))
    results.push(...checkUpstreamLocks(manifest))
  }

  return results
}

function main(): number {
  console.log('opencode-cc-camouflage compatibility canary')
  console.log('==========================================\n')

  const results = runAllChecks()
  const passed = results.filter(r => r.passed)
  const failed = results.filter(r => !r.passed)

  for (const result of results) {
    const symbol = result.passed ? '✓' : '✗'
    console.log(`${symbol} ${result.name}: ${result.message}`)
  }

  console.log('\n-------------------------------------------')
  console.log(`Results: ${passed.length} passed, ${failed.length} failed`)

  if (failed.length === 0) {
    console.log('Status: All checks passed ✓')
    return 0
  } else {
    console.log('Status: Some checks failed ✗')
    return 1
  }
}

process.exit(main())
