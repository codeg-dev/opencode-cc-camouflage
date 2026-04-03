import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { clearPatchMarkerForTests, runPatchApply } from '../../src/patch/apply'
import { runPatchRevert } from '../../src/patch/revert'
import { runPatchVerify } from '../../src/patch/verify'
import { prepareScenarioFromHome } from '../helpers/peer-scenario'
import { createTempHome } from '../helpers/temp-home'

const originalFallbackPaths = process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS

beforeEach(() => {
  process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = '~/github/not-claude-code-emulator'
})

afterEach(() => {
  if (originalFallbackPaths === undefined) {
    delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
  } else {
    process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = originalFallbackPaths
  }
})

describe('patch state machine', () => {
  test('applies clean target and becomes idempotent on second apply', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-patch' })
    try {
      await prepareScenarioFromHome(fixture.root)
      clearPatchMarkerForTests()

      const first = runPatchApply({ homeDir: fixture.root })
      expect(first.state).toBe('applied')
      expect(first.exitCode).toBe(0)

      const second = runPatchApply({ homeDir: fixture.root })
      expect(second.state).toBe('already_applied')
      expect(second.exitCode).toBe(0)
      expect(second.output).toContain('patch=already_applied')
    } finally {
      clearPatchMarkerForTests()
      await fixture.cleanup()
    }
  })

  test('reverts applied target back to clean state', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-revert' })
    try {
      await prepareScenarioFromHome(fixture.root)
      clearPatchMarkerForTests()

      const applied = runPatchApply({ homeDir: fixture.root })
      expect(applied.state).toBe('applied')

      const reverted = runPatchRevert({ homeDir: fixture.root })
      expect(reverted.state).toBe('clean')
      expect(reverted.exitCode).toBe(0)
      expect(reverted.output).toContain('patch=clean')

      const post = runPatchVerify({ homeDir: fixture.root })
      expect(post.state).toBe('clean')
      expect(post.exitCode).toBe(0)
    } finally {
      clearPatchMarkerForTests()
      await fixture.cleanup()
    }
  })

  test('refuses apply when target has drift', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-drift-patch' })
    try {
      await prepareScenarioFromHome(fixture.root)
      clearPatchMarkerForTests()

      const verify = runPatchVerify({ homeDir: fixture.root })
      expect(verify.state).toBe('drift')
      expect(verify.exitCode).toBe(1)

      const apply = runPatchApply({ homeDir: fixture.root })
      expect(apply.state).toBe('drift')
      expect(apply.exitCode).toBe(1)
      expect(apply.reason).toContain('version_hash_mismatch')
    } finally {
      clearPatchMarkerForTests()
      await fixture.cleanup()
    }
  })
})
