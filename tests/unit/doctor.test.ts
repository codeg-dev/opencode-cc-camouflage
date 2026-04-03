import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import { runDoctorTool } from '../../src/tools/doctor'
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

describe('doctor diagnostics', () => {
  test('reports clean state without repair actions', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean' })

    try {
      await prepareScenarioFromHome(fixture.root)

      const result = runDoctorTool({ homeDir: fixture.root })
      expect(result.diagnosis).toBe('clean')
      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('No repair is required right now.')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports missing peer with install hint', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-missing-peer' })

    try {
      await prepareScenarioFromHome(fixture.root)

      const result = runDoctorTool({ homeDir: fixture.root })
      expect(result.diagnosis).toBe('missing-peer')
      expect(result.exitCode).toBe(1)
      expect(result.output).toContain('@ex-machina/opencode-anthropic-auth')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports missing emulator when peer is healthy but prerequisite is gone', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-missing-emulator' })

    try {
      await prepareScenarioFromHome(fixture.root)
      await rm(join(fixture.root, 'github', 'not-claude-code-emulator'), { recursive: true, force: true })

      const result = runDoctorTool({ homeDir: fixture.root })
      expect(result.diagnosis).toBe('missing-emulator')
      expect(result.output).toContain('not-claude-code-emulator')
    } finally {
      await fixture.cleanup()
    }
  })

  test('treats win32 as a supported platform explicitly', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-win32' })

    try {
      await prepareScenarioFromHome(fixture.root)

      const result = runDoctorTool({ homeDir: fixture.root, platform: 'win32' })
      expect(result.diagnosis).toBe('clean')
      expect(result.status.support).toBe('supported')
      expect(result.output).toContain('doctor=clean')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports unsupported platforms explicitly', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-unsupported' })

    try {
      await prepareScenarioFromHome(fixture.root)

      const result = runDoctorTool({ homeDir: fixture.root, platform: 'freebsd' })
      expect(result.diagnosis).toBe('unsupported')
      expect(result.output).toContain('supported platform')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports drift when preflight anchors no longer match', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-drift' })

    try {
      await prepareScenarioFromHome(fixture.root)

      const result = runDoctorTool({ homeDir: fixture.root })
      expect(result.diagnosis).toBe('drift')
      expect(result.output).toContain('pinned preflight checks')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports readonly state without pretending the status contract changed', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-readonly' })

    try {
      await prepareScenarioFromHome(fixture.root)

      const result = runDoctorTool({ homeDir: fixture.root })
      expect(result.diagnosis).toBe('readonly')
      expect(result.exitCode).toBe(1)
      expect(result.status.patch).toBe('clean')
      expect(result.output).toContain('Read-only path detected')
    } finally {
      await fixture.cleanup()
    }
  })
})
