import { describe, expect, test } from 'bun:test'
import { applyPatch, parsePatch, reversePatch } from '../../src/patch/unified-diff'

describe('jsdiff Bun smoke test', () => {
  test('loads diff APIs and applies reversible unified patches', () => {
    const source = 'line 1\nline 2\nline 3\nline 4\n'
    const target = 'line 1\nline 2 updated\nline 3\nline 4\n'
    const patchText = [
      '--- a/example.txt',
      '+++ b/example.txt',
      '@@ -1,4 +1,4 @@',
      ' line 1',
      '-line 2',
      '+line 2 updated',
      ' line 3',
      ' line 4',
      '',
    ].join('\n')

    const parsed = parsePatch(patchText)
    const patch = parsed[0] ?? (() => { throw new Error('Expected one parsed patch') })()
    expect(parsed).toHaveLength(1)
    expect(patch.hunks).toHaveLength(1)

    const patched = applyPatch(source, patch)
    expect(patched).toBe(target)

    const reversed = reversePatch(parsed)
    expect(reversed).toHaveLength(1)
    const restored = applyPatch(target, reversed[0] ?? (() => { throw new Error('Expected one reversed patch') })())
    expect(restored).toBe(source)
  })

  test('returns false with fuzzFactor 0 when context no longer matches', () => {
    const source = 'line 1 changed\nline 2\nline 3\nline 4\n'
    const patchText = [
      '--- a/example.txt',
      '+++ b/example.txt',
      '@@ -1,4 +1,4 @@',
      ' line 1',
      '-line 2',
      '+line 2 updated',
      ' line 3',
      ' line 4',
      '',
    ].join('\n')

    const parsed = parsePatch(patchText)
    const patch = parsed[0] ?? (() => { throw new Error('Expected one parsed patch') })()
    expect(applyPatch(source, patch, { fuzzFactor: 0 })).toBe(false)
  })
})
