import { describe, expect, test } from 'bun:test'

import pluginModule, { createServerHooks, explicitToolIds, plugin, pluginEntry, pluginName, server } from '../../src/index'
import { serverEntrypoint } from '../../src/server'
import { tuiEntrypoint } from '../../src/tui'

describe('scaffold', () => {
  test('exports a plugin name and server module', () => {
    expect(pluginName).toBe('opencode-cc-camouflage')
    expect(plugin.id).toBe('opencode-cc-camouflage')
    expect(pluginEntry.id).toBe('opencode-cc-camouflage')
    expect(plugin.server).toBeTypeOf('function')
    expect(server).toBeTypeOf('function')
    expect(pluginModule).toBe(server)
  })

  test('keeps server and tui placeholder entry modules', () => {
    expect(serverEntrypoint.mode).toBe('server')
    expect(tuiEntrypoint.mode).toBe('tui')
  })

  test('registers the expected explicit tools', () => {
    const hooks = createServerHooks()
    expect(Object.keys(hooks.tool ?? {}).sort()).toEqual([...explicitToolIds].sort())
  })
})
