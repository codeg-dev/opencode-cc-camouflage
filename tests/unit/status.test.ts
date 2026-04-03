import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { detectStatus } from '../../src/runtime/detect'
import { classifyInstallModeForTests, looksLikePathForTests } from '../../src/runtime/peer-discovery'
import { formatStatus, isStatusHealthy } from '../../src/tools/status'
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

describe('status contract', () => {
  test('reports missing peer conservatively', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-missing-peer' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.peer).toBe('missing')
      expect(status.emulator).toBe('missing')
      expect(status.install_mode).toBe('unknown')
      expect(status.patch).toBe('incompatible')
      expect(isStatusHealthy(status)).toBe(false)
      expect(formatStatus(status)).toContain('peer=missing')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports clean peer when config-declared source exists', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.peer).toBe('present')
      expect(status.emulator).toBe('present')
      expect(status.install_mode).toBe('local-folder')
      expect(status.patch).toBe('clean')
      expect(isStatusHealthy(status)).toBe(true)
      expect(formatStatus(status)).toContain('install_mode=local-folder')
    } finally {
      await fixture.cleanup()
    }
  })

  test('accepts inline comments in opencode.jsonc local-folder declarations', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-jsonc-inline-comments' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const jsonPath = join(fixture.configDir, 'opencode.json')
      const jsoncPath = join(fixture.configDir, 'opencode.jsonc')
      const parsed = JSON.parse(await readFile(jsonPath, 'utf8')) as {
        plugins: Array<{ path: string }>
      }
      const peerPath = parsed.plugins[0]?.path
      if (!peerPath) {
        throw new Error('Expected prepared peer path in opencode.json')
      }

      await rm(jsonPath)
      await writeFile(
        jsoncPath,
        `{
          // local-folder plugin discovery stays preferred
          "plugins": [
            {
              "name": "@ex-machina/opencode-anthropic-auth",
              "path": "${peerPath}" // inline comment must not hide a valid path
            }
          ]
        }
`,
        'utf8',
      )

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.peer).toBe('present')
      expect(status.emulator).toBe('present')
      expect(status.install_mode).toBe('local-folder')
      expect(status.patch).toBe('clean')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports drift when peer targets no longer match preflight anchors', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-drift' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.peer).toBe('present')
      expect(status.emulator).toBe('present')
      expect(status.install_mode).toBe('local-folder')
      expect(status.patch).toBe('drift')
      expect(isStatusHealthy(status)).toBe(false)
      expect(formatStatus(status)).toContain('patch=drift')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports win32 platform as supported explicitly', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-win32' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const status = detectStatus({ homeDir: fixture.root, platform: 'win32' })
      expect(status.support).toBe('supported')
      expect(status.patch).toBe('clean')
      expect(isStatusHealthy(status)).toBe(true)
      expect(formatStatus(status)).toContain('support=supported')
    } finally {
      await fixture.cleanup()
    }
  })

  test('reports unsupported platforms explicitly', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-unsupported' })
    try {
      await prepareScenarioFromHome(fixture.root)

      const status = detectStatus({ homeDir: fixture.root, platform: 'freebsd' })
      expect(status.support).toBe('unsupported')
      expect(isStatusHealthy(status)).toBe(false)
      expect(formatStatus(status)).toContain('support=unsupported')
    } finally {
      await fixture.cleanup()
    }
  })

  test('recognizes Windows drive-letter peer paths during config discovery', () => {
    expect(looksLikePathForTests('C:\\Program Files\\nodejs\\node_modules\\@ex-machina\\opencode-anthropic-auth')).toBe(true)
    expect(looksLikePathForTests('c:/Users/codeg/.config/opencode/plugins/opencode-anthropic-auth')).toBe(true)
  })

  test('classifies Windows node_modules paths with spaces regardless of drive-letter case', () => {
    expect(
      classifyInstallModeForTests(
        'C:\\Program Files\\nodejs\\node_modules\\@ex-machina\\opencode-anthropic-auth',
      ),
    ).toBe('cache')
    expect(
      classifyInstallModeForTests(
        'c:\\Program Files\\nodejs\\node_modules\\@ex-machina\\opencode-anthropic-auth',
      ),
    ).toBe('cache')
    expect(classifyInstallModeForTests('C:\\Users\\codeg\\plugins\\opencode-anthropic-auth')).toBe('local-folder')
  })

  test('marks an explicitly configured but unreadable emulator root as unreachable', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-emulator-unreachable' })
    const originalRoot = process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
    try {
      await prepareScenarioFromHome(fixture.root)

      const bogusRoot = join(fixture.root, 'github', 'not-claude-code-emulator-bogus')
      await writeFile(bogusRoot, 'not a directory\n', 'utf8')
      process.env.CC_CAMOUFLAGE_EMULATOR_ROOT = bogusRoot

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.emulator).toBe('unreachable')
      expect(isStatusHealthy(status)).toBe(false)
    } finally {
      if (originalRoot === undefined) {
        delete process.env.CC_CAMOUFLAGE_EMULATOR_ROOT
      } else {
        process.env.CC_CAMOUFLAGE_EMULATOR_ROOT = originalRoot
      }
      await fixture.cleanup()
    }
  })

  test('does not treat a README-only emulator folder as present', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-readme-only-emulator' })
    try {
      await prepareScenarioFromHome(fixture.root)

      await rm(join(fixture.root, 'github', 'not-claude-code-emulator', 'package.json'))

      const status = detectStatus({ homeDir: fixture.root })
      expect(status.emulator).toBe('unreachable')
      expect(isStatusHealthy(status)).toBe(false)
    } finally {
      await fixture.cleanup()
    }
  })
})
