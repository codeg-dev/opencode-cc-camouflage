import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { applyPatchToFile, dryRunPatch, revertPatchFromFile } from '../../src/patch/js-engine'

const ORIGINAL_CONTENT = `export const value = 1;
export function greet() {
  return 'hello';
}
`

const PATCH_CONTENT = `diff --git a/src/foo.ts b/src/foo.ts
index 1111111..2222222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,4 +1,4 @@
 export const value = 1;
 export function greet() {
-  return 'hello';
+  return 'hello world';
 }
`

const MODIFIED_SOURCE = `export const value = 1;
export function greet() {
  return 'hello from drift';
}
`

describe('js patch engine', () => {
  test('applyPatchToFile applies a -p1 style patch to peer files', async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'js-engine-apply-'))
    const filePath = path.join(fixtureRoot, 'src', 'foo.ts')

    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, ORIGINAL_CONTENT, 'utf8')
      const result = applyPatchToFile(PATCH_CONTENT, fixtureRoot)

      expect(result).toEqual({ ok: true })
      await expect(readFile(filePath, 'utf8')).resolves.toContain("return 'hello world';")
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  })

  test('revertPatchFromFile restores original file state', async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'js-engine-revert-'))
    const filePath = path.join(fixtureRoot, 'src', 'foo.ts')

    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, ORIGINAL_CONTENT, 'utf8')
      expect(applyPatchToFile(PATCH_CONTENT, fixtureRoot)).toEqual({ ok: true })

      const reverted = revertPatchFromFile(PATCH_CONTENT, fixtureRoot)
      expect(reverted).toEqual({ ok: true })
      await expect(readFile(filePath, 'utf8')).resolves.toBe(ORIGINAL_CONTENT)
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  })

  test('dryRunPatch validates patchability without modifying file', async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'js-engine-dry-run-'))
    const filePath = path.join(fixtureRoot, 'src', 'foo.ts')

    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, ORIGINAL_CONTENT, 'utf8')

      const result = dryRunPatch(PATCH_CONTENT, fixtureRoot, {})
      expect(result).toEqual({ ok: true })
      await expect(readFile(filePath, 'utf8')).resolves.toBe(ORIGINAL_CONTENT)
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  })

  test('fuzzFactor 0 refuses context drift and reports failed hunk', async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'js-engine-fuzz-'))
    const filePath = path.join(fixtureRoot, 'src', 'foo.ts')

    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, MODIFIED_SOURCE, 'utf8')

      const result = applyPatchToFile(PATCH_CONTENT, fixtureRoot)
      expect(result.ok).toBe(false)
      expect(result.message).toContain('failed_to_apply_hunk')
      expect(result.message).toContain('hunk=1')
      await expect(readFile(filePath, 'utf8')).resolves.toBe(MODIFIED_SOURCE)
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  })
})
