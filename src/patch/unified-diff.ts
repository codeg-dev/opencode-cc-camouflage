export interface ApplyPatchOptions {
  autoConvertLineEndings?: boolean
  fuzzFactor?: number
}

export interface ParsedHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

export interface ParsedPatch {
  oldFileName: string
  newFileName: string
  hunks: ParsedHunk[]
}

function normalizePatchText(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function parseCount(value: string | undefined): number {
  if (!value) {
    return 1
  }

  return Number.parseInt(value, 10)
}

function countOldLines(lines: string[]): number {
  return lines.filter((line) => !line.startsWith('+') && !line.startsWith('\\')).length
}

function countNewLines(lines: string[]): number {
  return lines.filter((line) => !line.startsWith('-') && !line.startsWith('\\')).length
}

function splitSource(source: string, autoConvertLineEndings: boolean): {
  lines: string[]
  endsWithNewline: boolean
} {
  const normalized = autoConvertLineEndings ? normalizePatchText(source) : source
  const endsWithNewline = normalized.endsWith('\n')
  const body = endsWithNewline ? normalized.slice(0, -1) : normalized

  return {
    lines: body.length === 0 ? [] : body.split('\n'),
    endsWithNewline,
  }
}

function joinSource(lines: string[], endsWithNewline: boolean): string {
  const joined = lines.join('\n')
  return endsWithNewline ? `${joined}\n` : joined
}

export function parsePatch(patchContent: string): ParsedPatch[] {
  const lines = normalizePatchText(patchContent).split('\n')
  const patches: ParsedPatch[] = []
  let current: ParsedPatch | undefined
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (line.startsWith('diff --git ')) {
      if (current && (current.oldFileName || current.newFileName || current.hunks.length > 0)) {
        patches.push(current)
      }

      current = {
        oldFileName: '',
        newFileName: '',
        hunks: [],
      }
      index += 1
      continue
    }

    if (line.startsWith('--- ')) {
      current ??= { oldFileName: '', newFileName: '', hunks: [] }
      current.oldFileName = line.slice(4).trim()
      index += 1
      continue
    }

    if (line.startsWith('+++ ')) {
      current ??= { oldFileName: '', newFileName: '', hunks: [] }
      current.newFileName = line.slice(4).trim()
      index += 1
      continue
    }

    const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (header) {
      current ??= { oldFileName: '', newFileName: '', hunks: [] }
      const hunkLines: string[] = []
      index += 1

      while (index < lines.length) {
        const hunkLine = lines[index] ?? ''
        if (
          hunkLine.startsWith('diff --git ') ||
          hunkLine.startsWith('--- ') ||
          hunkLine.startsWith('+++ ') ||
          hunkLine.startsWith('@@ ')
        ) {
          break
        }

        if (
          hunkLine.startsWith(' ') ||
          hunkLine.startsWith('+') ||
          hunkLine.startsWith('-') ||
          hunkLine.startsWith('\\')
        ) {
          hunkLines.push(hunkLine)
        }
        index += 1
      }

      current.hunks.push({
        oldStart: Number.parseInt(header[1] ?? '0', 10),
        oldLines: parseCount(header[2]),
        newStart: Number.parseInt(header[3] ?? '0', 10),
        newLines: parseCount(header[4]),
        lines: hunkLines,
      })
      continue
    }

    index += 1
  }

  if (current && (current.oldFileName || current.newFileName || current.hunks.length > 0)) {
    patches.push(current)
  }

  return patches
}

export function applyPatch(source: string, patch: ParsedPatch, options: ApplyPatchOptions = {}): string | false {
  if (options.fuzzFactor && options.fuzzFactor !== 0) {
    return false
  }

  const { lines: sourceLines, endsWithNewline } = splitSource(source, options.autoConvertLineEndings === true)
  const output: string[] = []
  let sourceIndex = 0

  for (const hunk of patch.hunks) {
    const expectedOldLines = countOldLines(hunk.lines)
    const expectedNewLines = countNewLines(hunk.lines)
    if (expectedOldLines !== hunk.oldLines || expectedNewLines !== hunk.newLines) {
      return false
    }

    const hunkStart = Math.max(hunk.oldStart - 1, 0)
    if (hunkStart < sourceIndex) {
      return false
    }

    output.push(...sourceLines.slice(sourceIndex, hunkStart))
    let hunkIndex = hunkStart

    for (const line of hunk.lines) {
      const marker = line[0]
      const content = line.slice(1)

      if (marker === ' ') {
        if (sourceLines[hunkIndex] !== content) {
          return false
        }
        output.push(content)
        hunkIndex += 1
        continue
      }

      if (marker === '-') {
        if (sourceLines[hunkIndex] !== content) {
          return false
        }
        hunkIndex += 1
        continue
      }

      if (marker === '+') {
        output.push(content)
        continue
      }

      if (marker === '\\') {
        continue
      }

      return false
    }

    sourceIndex = hunkIndex
  }

  output.push(...sourceLines.slice(sourceIndex))
  return joinSource(output, endsWithNewline)
}

function reverseParsedPatch(patch: ParsedPatch): ParsedPatch {
  return {
    oldFileName: patch.newFileName,
    newFileName: patch.oldFileName,
    hunks: patch.hunks.map((hunk) => ({
      oldStart: hunk.newStart,
      oldLines: hunk.newLines,
      newStart: hunk.oldStart,
      newLines: hunk.oldLines,
      lines: hunk.lines.map((line) => {
        if (line.startsWith('+')) {
          return `-${line.slice(1)}`
        }

        if (line.startsWith('-')) {
          return `+${line.slice(1)}`
        }

        return line
      }),
    })),
  }
}

export function reversePatch(patch: ParsedPatch): ParsedPatch
export function reversePatch(patch: ParsedPatch[]): ParsedPatch[]
export function reversePatch(patch: ParsedPatch | ParsedPatch[]): ParsedPatch | ParsedPatch[] {
  return Array.isArray(patch) ? patch.map(reverseParsedPatch) : reverseParsedPatch(patch)
}
