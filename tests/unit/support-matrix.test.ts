import { describe, expect, test } from 'bun:test'

import { detectSupport } from '../../src/runtime/support-matrix'

describe('support matrix', () => {
  test('marks win32 as supported', () => {
    expect(detectSupport('win32')).toEqual({
      support: 'supported',
      platform: 'win32',
    })
  })

  test('keeps unsupported platforms explicit', () => {
    expect(detectSupport('freebsd')).toEqual({
      support: 'unsupported',
      platform: 'freebsd',
    })
  })
})
