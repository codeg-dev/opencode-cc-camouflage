import { describe, expect, test } from 'bun:test'

import {
  documentedOAuthSourcePrecedence,
  resolveOAuthSourceResolution,
} from '../../src/runtime/oauth-sources'

describe('oauth source precedence', () => {
  test('keeps documented precedence in headful environments with Claude Safe Storage', () => {
    const resolution = resolveOAuthSourceResolution({
      headless: false,
      hasClaudeSafeStorage: true,
    })

    expect(documentedOAuthSourcePrecedence).toEqual([
      'claude-desktop-cache',
      'system-keychain',
      'opencode-auth-store',
    ])
    expect(resolution.effectivePrecedence).toEqual([...documentedOAuthSourcePrecedence])
    expect(resolution.canonicalSource).toBe('claude-desktop-cache')
    expect(resolution.headlessException).toBe(false)
  })

  test('collapses to the OpenCode auth store when headless exception applies', () => {
    const resolution = resolveOAuthSourceResolution({
      headless: true,
      hasClaudeSafeStorage: false,
    })

    expect(resolution.effectivePrecedence).toEqual(['opencode-auth-store'])
    expect(resolution.canonicalSource).toBe('opencode-auth-store')
    expect(resolution.headlessException).toBe(true)
    expect(resolution.notes.join(' ')).toContain('fallback canonical source')
  })
})
