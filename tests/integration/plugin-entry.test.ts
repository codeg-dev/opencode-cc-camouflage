import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

import type { ToolContext } from '../../src/plugin-api'

import { createServerHooks, explicitToolIds, pluginName } from '../../src/index'
import { prepareScenarioFromHome } from '../helpers/peer-scenario'
import { createTempHome } from '../helpers/temp-home'

const repoRoot = resolve(import.meta.dir, '..', '..')
const originalFallbackPaths = process.env.CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS

function createToolContext() {
  const metadataCalls: Array<Parameters<ToolContext['metadata']>[0]> = []

  const context: ToolContext = {
    sessionID: 'ses-plugin-entry',
    messageID: 'msg-plugin-entry',
    agent: 'build',
    directory: repoRoot,
    worktree: repoRoot,
    abort: new AbortController().signal,
    metadata(input) {
      metadataCalls.push(input)
    },
    async ask() {},
  }

  return { context, metadataCalls }
}

describe('plugin-entry', () => {
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

  test('registers explicit tools and stable hooks only', () => {
    const hooks = createServerHooks()

    expect(Object.keys(hooks.tool ?? {}).sort()).toEqual([...explicitToolIds].sort())
    expect(hooks['command.execute.before']).toBeTypeOf('function')
    expect(hooks['tool.execute.after']).toBeTypeOf('function')
    expect(hooks['experimental.chat.system.transform']).toBeUndefined()
  })

  test('status and doctor tools expose existing read-only contracts', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-plugin-entry' })

    try {
      await prepareScenarioFromHome(fixture.root)

      const hooks = createServerHooks()
      const toolRegistry = hooks.tool
      if (!toolRegistry) {
        throw new Error('Expected explicit tool registry to be present')
      }
      if (!toolRegistry.status || !toolRegistry.doctor) {
        throw new Error('Expected status and doctor tools to be registered')
      }

      const { context, metadataCalls } = createToolContext()

      const statusOutput = await toolRegistry.status.execute({ homeDir: fixture.root, cwd: repoRoot }, context)
      expect(statusOutput).toContain('peer=present')
      expect(statusOutput).toContain('emulator=present')
      expect(statusOutput).toContain('patch=clean')

      const doctorOutput = await toolRegistry.doctor.execute({ homeDir: fixture.root, cwd: repoRoot }, context)
      expect(doctorOutput).toContain('doctor=clean')
      expect(doctorOutput).toContain('did not install, patch, or touch auth/token state')

      expect(metadataCalls.some((call) => call.metadata?.plugin === pluginName)).toBe(true)
    } finally {
      await fixture.cleanup()
    }
  })

  test('patch tools stay explicit surfaces and describe non-automatic behavior', () => {
    const hooks = createServerHooks()
    const toolRegistry = hooks.tool
    if (!toolRegistry) {
      throw new Error('Expected explicit tool registry to be present')
    }

    expect(toolRegistry.patch_apply?.description).toContain('never runs automatically')
    expect(toolRegistry.patch_revert?.description).toContain('never runs automatically')
  })
})
