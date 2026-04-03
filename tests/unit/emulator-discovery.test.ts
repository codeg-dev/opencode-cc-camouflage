import { afterEach, describe, expect, mock, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import {
  detectStatus,
  resetDetectSpawnSyncForTests,
  setDetectSpawnSyncForTests,
} from '../../src/runtime/detect'
import { createTempHome } from '../helpers/temp-home'

type SpawnSyncResult = {
  error?: NodeJS.ErrnoException
  status: number | null
  stdout: string
}

type SpawnSyncImplementation = (
  command: string,
  args: string[],
  options: {
    encoding: string
    timeout: number
  },
) => SpawnSyncResult

const originalEmulatorRoot = process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
const originalFallbackPaths = process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS

function createSpawnSyncResult(overrides: Partial<SpawnSyncResult> = {}): SpawnSyncResult {
  return {
    status: 0,
    stdout: '',
    ...overrides,
  }
}

function installSpawnSyncMock(implementation: SpawnSyncImplementation) {
  const spawnSyncMock = mock(implementation)
  setDetectSpawnSyncForTests((command, args, options) => spawnSyncMock(command, args, options))
  return spawnSyncMock
}

async function writeRecognizedEmulatorRoot(root: string): Promise<void> {
  await mkdir(root, { recursive: true })
  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'not-claude-code-emulator', private: true }, null, 2)}\n`,
    'utf8',
  )
}

async function writeUnrecognizedEmulatorRoot(root: string): Promise<void> {
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'README.md'), '# placeholder\n', 'utf8')
}

afterEach(() => {
  if (originalEmulatorRoot === undefined) {
    delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
  } else {
    process.env.CC_CAMOUFLAGE_EMULATOR_ROOT = originalEmulatorRoot
  }

  if (originalFallbackPaths === undefined) {
    delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS
  } else {
    process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = originalFallbackPaths
  }

  resetDetectSpawnSyncForTests()
})

describe('emulator discovery', () => {
  test('prefers CC_CAMOUFLAGE_EMULATOR_ROOT over npm global discovery', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-emulator-env-priority' })
    try {
      const explicitRoot = join(fixture.root, 'custom-emulator')
      const npmGlobalRoot = join(fixture.root, 'npm-global')

      await writeRecognizedEmulatorRoot(explicitRoot)
      await writeUnrecognizedEmulatorRoot(join(npmGlobalRoot, 'not-claude-code-emulator'))

      process.env.CC_CAMOUFLAGE_EMULATOR_ROOT = explicitRoot
      delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS

      const spawnSyncMock = installSpawnSyncMock(() =>
        createSpawnSyncResult({ stdout: `${npmGlobalRoot}\n` }),
      )

      const status = detectStatus({ homeDir: fixture.root })

      expect(status.emulator).toBe('present')
      expect(spawnSyncMock).not.toHaveBeenCalled()
    } finally {
      await fixture.cleanup()
    }
  })

  test('detects emulator from npm root -g output', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-emulator-npm-global' })
    try {
      const npmGlobalRoot = join(fixture.root, 'npm-global')
      await writeRecognizedEmulatorRoot(join(npmGlobalRoot, 'not-claude-code-emulator'))

      delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
      delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS

      const spawnSyncMock = installSpawnSyncMock((command, args, options) => {
        expect(command).toBe('npm')
        expect(args).toEqual(['root', '-g'])
        expect(options).toEqual({ encoding: 'utf8', timeout: 5000 })

        return createSpawnSyncResult({ stdout: `${npmGlobalRoot}\r\n` })
      })

      const status = detectStatus({ homeDir: fixture.root })

      expect(status.emulator).toBe('present')
      expect(spawnSyncMock).toHaveBeenCalledTimes(1)
    } finally {
      await fixture.cleanup()
    }
  })

  test('gracefully skips npm discovery when npm is not installed', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-emulator-no-npm' })
    try {
      delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
      delete process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS

      const spawnSyncMock = installSpawnSyncMock(() => {
        const error = new Error('npm not found') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        throw error
      })

      const status = detectStatus({ homeDir: fixture.root })

      expect(status.emulator).toBe('missing')
      expect(spawnSyncMock).toHaveBeenCalledTimes(1)
    } finally {
      await fixture.cleanup()
    }
  })

  test('uses configured fallback paths after npm discovery is skipped', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-emulator-fallback-paths' })
    try {
      const fallbackRoot = join(fixture.root, 'fallbacks', 'preferred-emulator')
      await writeRecognizedEmulatorRoot(fallbackRoot)

      delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
      process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS = [
        join(fixture.root, 'fallbacks', 'missing-emulator'),
        '~/fallbacks/preferred-emulator',
      ].join(delimiter)

      const spawnSyncMock = installSpawnSyncMock(() =>
        createSpawnSyncResult({ status: 1, stdout: '' }),
      )

      const status = detectStatus({ homeDir: fixture.root })

      expect(status.emulator).toBe('present')
      expect(spawnSyncMock).toHaveBeenCalledTimes(1)
    } finally {
      await fixture.cleanup()
    }
  })
})
