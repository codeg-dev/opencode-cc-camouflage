import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  detectStatus,
  resetDetectSpawnSyncForTests,
  setDetectSpawnSyncForTests,
} from '../../src/runtime/detect'
import { formatStatus } from '../../src/tools/status'
import { prepareScenarioFromHome, writeRecognizedEmulatorRoot } from '../helpers/peer-scenario'
import { createTempHome } from '../helpers/temp-home'

const originalFallbackPaths = process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
const originalEmulatorRoot = process.env.CC_CAMOUFLAGE_EMULATOR_ROOT

beforeEach(() => {
  process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = '~/github/not-claude-code-emulator'
  delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
  resetDetectSpawnSyncForTests()
})

afterEach(() => {
  if (originalFallbackPaths === undefined) {
    delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
  } else {
    process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = originalFallbackPaths
  }

  if (originalEmulatorRoot === undefined) {
    delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
  } else {
    process.env.CC_CAMOUFLAGE_EMULATOR_ROOT = originalEmulatorRoot
  }

  resetDetectSpawnSyncForTests()
})

describe('smoke:peer-auth scaffold contract', () => {
  test('missing-peer scenario returns machine-readable status with missing peer', async () => {
    const fixture = await createTempHome()
    try {
      await prepareScenarioFromHome(fixture.root)

      const status = detectStatus({ homeDir: fixture.root })
      expect(formatStatus(status)).toContain('peer=missing')
      expect(formatStatus(status)).toContain('emulator=missing')
    } finally {
      await fixture.cleanup()
    }
  })

  test('clean scenario can be prepared without real home pollution', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean' })
    try {
      const scenario = await prepareScenarioFromHome(fixture.root)

      expect(scenario).toBe('clean')
      const status = detectStatus({ homeDir: fixture.root })
      expect(status.install_mode).toBe('local-folder')
      expect(status.emulator).toBe('present')
    } finally {
      await fixture.cleanup()
    }
  })

  test('jsonc inline comments keep local-folder peer discovery working end to end', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-smoke-jsonc' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const jsonPath = join(fixture.configDir, 'opencode.json')
      const jsoncPath = join(fixture.configDir, 'opencode.jsonc')
      const parsed = JSON.parse(await readFile(jsonPath, 'utf8')) as {
        plugins: Array<{ path: string }>
      }
      const peerPath = parsed.plugins[0]?.path
      if (!peerPath) {
        throw new Error('Expected peer path in prepared config')
      }

      await rm(jsonPath)
      await writeFile(
        jsoncPath,
        `{
          "plugins": [
            {
              "name": "@ex-machina/opencode-anthropic-auth",
              "path": "${peerPath}" // inline comment
            }
          ]
        }
`,
        'utf8',
      )

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.peer).toBe('present')
      expect(status.install_mode).toBe('local-folder')
    } finally {
      await fixture.cleanup()
    }
  })

  test('clean scenario stays healthy under a win32 platform mock', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-smoke-win32' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const status = detectStatus({ homeDir: fixture.root, platform: 'win32' })
      expect(status.support).toBe('supported')
      expect(status.peer).toBe('present')
      expect(status.emulator).toBe('present')
      expect(status.patch).toBe('clean')
      expect(formatStatus(status)).toContain('support=supported')
    } finally {
      await fixture.cleanup()
    }
  })

  test('npm global emulator discovery keeps smoke status healthy without fallback paths', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-smoke-npm-global' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const npmGlobalRoot = join(fixture.root, 'npm-global')
      await writeRecognizedEmulatorRoot(join(npmGlobalRoot, 'not-claude-code-emulator'))

      delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
      delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT

      setDetectSpawnSyncForTests((command, args, options) => {
        expect(command).toBe('npm')
        expect(args).toEqual(['root', '-g'])
        expect(options).toEqual({ encoding: 'utf8', timeout: 5000 })

        return {
          status: 0,
          stdout: `${npmGlobalRoot}\n`,
        }
      })

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.peer).toBe('present')
      expect(status.emulator).toBe('present')
      expect(status.patch).toBe('clean')
      expect(formatStatus(status)).toContain('emulator=present')
    } finally {
      await fixture.cleanup()
    }
  })
})
