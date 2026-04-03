import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dir, '..', '..')
const patchesRoot = resolve(repoRoot, 'patches')

function collectPatchFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectPatchFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.patch')) {
      files.push(fullPath)
    }
  }

  return files.sort()
}

function readPatchFile(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('patch compatibility assumptions', () => {
  const patchFiles = collectPatchFiles(patchesRoot)

  test('patch files exist', () => {
    expect(patchFiles.length).toBeGreaterThan(0)
  })

  test('patch files contain no binary hunks', () => {
    for (const patchPath of patchFiles) {
      const contents = readPatchFile(patchPath)
      expect(contents.includes('Binary files')).toBe(false)
    }
  })

  test('patch files contain no file create or delete operations', () => {
    const fileModePattern = /^(new file mode|deleted file mode)\b/m

    for (const patchPath of patchFiles) {
      const contents = readPatchFile(patchPath)
      expect(fileModePattern.test(contents)).toBe(false)
      expect(contents.includes('--- /dev/null')).toBe(false)
      expect(contents.includes('+++ /dev/null')).toBe(false)
    }
  })

  test('patch headers and file markers use a/b prefixes', () => {
    const diffHeaderPattern = /^diff --git a\/.+ b\/.+$/
    const fileMarkerPattern = /^(---|\+\+\+) (a|b)\/.+$/

    for (const patchPath of patchFiles) {
      const contents = readPatchFile(patchPath)
      const lines = contents.split(/\r?\n/)

      for (const line of lines) {
        if (line.startsWith('diff --git ')) {
          expect(diffHeaderPattern.test(line)).toBe(true)
        }

        if (line.startsWith('--- ') || line.startsWith('+++ ')) {
          expect(fileMarkerPattern.test(line)).toBe(true)
        }
      }
    }
  })

  test('patch files do not contain no-newline markers', () => {
    for (const patchPath of patchFiles) {
      const contents = readPatchFile(patchPath)
      expect(contents.includes('\\ No newline at end of file')).toBe(false)
    }
  })
})
