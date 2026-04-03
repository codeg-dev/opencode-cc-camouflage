import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'

import { runTarballSmoke } from '../helpers/packed-artifact'
import { removeManagedHome } from '../helpers/temp-home'

const repoRoot = resolve(import.meta.dir, '..', '..')
const integrationTimeoutMs = 30_000

describe('packed tarball smoke', () => {
  test('packed tarball preserves verify-only entry behavior beside the peer fixture', async () => {
    const homeDir = join(repoRoot, '.tmp', 'home-pack-tarball-it')

    try {
      const result = await runTarballSmoke(homeDir)
      expect(result.scenario).toBe('clean')
      expect(result.statusExitCode).toBe(0)
      expect(result.statusOutput).toContain('peer=present')
      expect(result.statusOutput).toContain('patch=clean')
      expect(result.doctorExitCode).toBe(0)
      expect(result.doctorOutput).toContain('doctor=clean')
      expect(result.doctorOutput).toContain('did not install, patch, or touch auth/token state')
      expect(result.warningText).toContain('automatic hooks are verify-only')
      expect(result.afterTitle).toBe('Camouflage Status')
      expect(result.afterMetadata.plugin).toBe('opencode-cc-camouflage')
      expect(result.afterMetadata.verifyOnly).toBe(true)
      expect(result.afterMetadata.mutated).toBe(false)
    } finally {
      await removeManagedHome(homeDir)
    }
  }, integrationTimeoutMs)

  test('packed tarball missing-peer scenario remains non-zero and machine-readable', async () => {
    const homeDir = join(repoRoot, '.tmp', 'home-pack-missing-peer-tarball-it')

    try {
      const result = await runTarballSmoke(homeDir)
      expect(result.scenario).toBe('missing-peer')
      expect(result.statusExitCode).toBe(1)
      expect(result.statusOutput).toContain('peer=missing')
      expect(result.doctorOutput).toBeUndefined()
      expect(result.warningText).toContain('automatic hooks are verify-only')
      expect(result.afterMetadata.plugin).toBe('opencode-cc-camouflage')
    } finally {
      await removeManagedHome(homeDir)
    }
  }, integrationTimeoutMs)
})
