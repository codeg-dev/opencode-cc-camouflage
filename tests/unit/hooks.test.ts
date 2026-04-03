import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { clearPatchMarkerForTests } from '../../src/patch/apply'
import { createServerHooks, verifyOnlyCommandNote } from '../../src/index'
import { prepareScenarioFromHome } from '../helpers/peer-scenario'
import { createTempHome, snapshotTree } from '../helpers/temp-home'

const repoRoot = resolve(import.meta.dir, '..', '..')
const markerPath = join(repoRoot, '.tmp', 'patch-state', 'opencode-anthropic-auth.json')

describe('hooks', () => {
  test('command.execute.before warns without mutating peer or auth state', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-hooks' })

    try {
      await prepareScenarioFromHome(fixture.root)
      const authPath = join(fixture.configDir, 'auth.json')
      await writeFile(authPath, `${JSON.stringify({ access: 'token', refresh: 'secret' }, null, 2)}\n`, 'utf8')

      clearPatchMarkerForTests({ repoRoot })
      const beforeSnapshot = await snapshotTree(fixture.root)
      const beforeAuth = await readFile(authPath, 'utf8')

      const hooks = createServerHooks()
      const hook = hooks['command.execute.before']
      if (!hook) {
        throw new Error('Expected command.execute.before hook to be registered')
      }

      const output: Parameters<typeof hook>[1] = { parts: [] }
  await hook({ command: 'patch_apply', sessionID: 'ses-hooks', arguments: '' }, output)

      expect(output.parts).toHaveLength(1)
      const warning = output.parts[0]
      if (!warning) {
        throw new Error('Expected command.execute.before to add a warning part')
      }
      expect(warning.type).toBe('text')
      if (warning.type !== 'text') {
        throw new Error('Expected command warning to be a text part')
      }
      expect(warning.text).toBe(verifyOnlyCommandNote)
      expect(warning.metadata?.mutated).toBe(false)

      const afterSnapshot = await snapshotTree(fixture.root)
      const afterAuth = await readFile(authPath, 'utf8')

      expect(afterSnapshot).toBe(beforeSnapshot)
      expect(afterAuth).toBe(beforeAuth)
      expect(existsSync(markerPath)).toBe(false)
    } finally {
      clearPatchMarkerForTests({ repoRoot })
      await fixture.cleanup()
    }
  })

  test('tool.execute.after only annotates verify-only tool results', async () => {
    const fixture = await createTempHome({ homeSuffix: 'home-clean-hooks-after' })

    try {
      await prepareScenarioFromHome(fixture.root)
      clearPatchMarkerForTests({ repoRoot })

      const beforeSnapshot = await snapshotTree(fixture.root)
      const hooks = createServerHooks()
      const hook = hooks['tool.execute.after']
      if (!hook) {
        throw new Error('Expected tool.execute.after hook to be registered')
      }

      const output: Parameters<typeof hook>[1] = {
        title: '',
        output: 'peer=present\npatch=clean',
        metadata: { existing: true },
      }

      await hook({ tool: 'status', sessionID: 'ses-hooks-after', callID: 'call-status', args: {} }, output)

      expect(output.title).toBe('Camouflage Status')
      if (!output.metadata || typeof output.metadata !== 'object' || Array.isArray(output.metadata)) {
        throw new Error('Expected tool.execute.after metadata to remain an object')
      }
      expect(output.metadata.plugin).toBe('opencode-cc-camouflage')
      expect(output.metadata.verifyOnly).toBe(true)
      expect(output.metadata.mutated).toBe(false)

      const afterSnapshot = await snapshotTree(fixture.root)
      expect(afterSnapshot).toBe(beforeSnapshot)
      expect(existsSync(markerPath)).toBe(false)
    } finally {
      clearPatchMarkerForTests({ repoRoot })
      await fixture.cleanup()
    }
  })
})
