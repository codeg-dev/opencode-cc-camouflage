import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { publishedPatchPreflightChecks, publishedReferenceFixtureNames } from '../../src/runtime/published-metadata'

const repoRoot = resolve(import.meta.dir, '..', '..')

type ManifestDoc = {
  packages?: Array<{
    name?: string
    preflightTargetChecks?: Array<{
      targetPath?: string
      fallbackPath?: string
      contains?: string
    }>
  }>
  referenceFixtures?: Array<{
    name?: string
  }>
}

describe('published metadata', () => {
  test('stays aligned with the source manifest used for pack safety', async () => {
    const manifestPath = resolve(repoRoot, 'patches', 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ManifestDoc
    const peerPackage = (manifest.packages ?? []).find((item) => item.name === 'opencode-anthropic-auth')
    const expectedChecks = (peerPackage?.preflightTargetChecks ?? []).map((check) => ({
      targetPath: check.targetPath ?? '',
      ...(check.fallbackPath !== undefined ? { fallbackPath: check.fallbackPath } : {}),
      contains: check.contains ?? '',
    }))

    expect(publishedPatchPreflightChecks).toEqual(expectedChecks)
    expect(publishedReferenceFixtureNames).toContain('not-claude-code-emulator')
    expect((manifest.referenceFixtures ?? []).some((fixture) => fixture.name === 'not-claude-code-emulator')).toBe(
      true,
    )
  })
})
