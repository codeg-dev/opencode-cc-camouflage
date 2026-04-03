import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { applyPatch, parsePatch, reversePatch } from './unified-diff'

export type JsPatchResult = {
  ok: boolean
  message?: string
}

type JsPatchOptions = {
  dryRun?: boolean
}

type DryRunOptions = {
  reverse?: boolean
}

type ParsedPatch = ReturnType<typeof parsePatch>[number]
type PatchHunk = ParsedPatch['hunks'][number]

const APPLY_OPTIONS = {
  autoConvertLineEndings: true,
  fuzzFactor: 0,
} as const

function stripFirstPathComponent(fileName: string): string {
  if (fileName === '/dev/null') {
    return fileName
  }

  const normalized = fileName.replace(/\\/g, '/').replace(/^\/+/, '')
  const slashIndex = normalized.indexOf('/')
  if (slashIndex < 0) {
    return normalized
  }

  return normalized.slice(slashIndex + 1)
}

function normalizeParsedDiff(diff: ParsedPatch): ParsedPatch {
  return {
    ...diff,
    oldFileName: stripFirstPathComponent(diff.oldFileName),
    newFileName: stripFirstPathComponent(diff.newFileName),
  }
}

function resolveTargetPath(diff: ParsedPatch): string | undefined {
  if (diff.newFileName && diff.newFileName !== '/dev/null') {
    return diff.newFileName
  }
  if (diff.oldFileName && diff.oldFileName !== '/dev/null') {
    return diff.oldFileName
  }
  return undefined
}

function resolvePeerFilePath(peerRoot: string, patchPath: string): string {
  const absoluteRoot = path.resolve(peerRoot)
  const absolutePath = path.resolve(absoluteRoot, patchPath)
  const relative = path.relative(absoluteRoot, absolutePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`patch_target_outside_peer_root ${patchPath}`)
  }
  return absolutePath
}

function applyWithHunkDiagnosis(source: string, diff: ParsedPatch): { ok: true; output: string } | { ok: false; message: string } {
  const output = applyPatch(source, diff, APPLY_OPTIONS)
  if (output !== false) {
    return { ok: true, output }
  }

  const failedHunk = detectFailedHunk(source, diff)
  const file = resolveTargetPath(diff) ?? 'unknown_file'
  return {
    ok: false,
    message: `failed_to_apply_hunk file=${file} ${failedHunk}`,
  }
}

function detectFailedHunk(source: string, diff: ParsedPatch): string {
  const hunks = diff.hunks ?? []
  if (hunks.length === 0) {
    return 'hunk=none'
  }

  for (let index = 0; index < hunks.length; index += 1) {
    const probe: ParsedPatch = {
      ...diff,
      hunks: hunks.slice(0, index + 1),
    }
    const applied = applyPatch(source, probe, APPLY_OPTIONS)
    if (applied === false) {
      const hunk = hunks[index]
      if (!hunk) {
        return 'hunk=unknown'
      }
      return formatHunk(index, hunk)
    }
  }

  return 'hunk=unknown'
}

function formatHunk(index: number, hunk: PatchHunk): string {
  return `hunk=${index + 1} oldStart=${hunk.oldStart} oldLines=${hunk.oldLines} newStart=${hunk.newStart} newLines=${hunk.newLines}`
}

function parseAndNormalizePatch(patchContent: string): ParsedPatch[] | undefined {
  const parsed = parsePatch(patchContent).map(normalizeParsedDiff)
  if (parsed.length === 0) {
    return undefined
  }
  return parsed
}

function runParsedPatch(parsed: ParsedPatch[], peerRoot: string, options: JsPatchOptions = {}): JsPatchResult {
  if (parsed.length === 0) {
    return { ok: false, message: 'patch_parse_failed' }
  }

  const nextContents = new Map<string, string>()
  for (const parsedDiff of parsed) {
    const targetPath = resolveTargetPath(parsedDiff)
    if (!targetPath) {
      return { ok: false, message: 'patch_target_path_missing' }
    }

    let fullPath: string
    try {
      fullPath = resolvePeerFilePath(peerRoot, targetPath)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'patch_target_outside_peer_root' }
    }

    let sourceContent: string
    try {
      sourceContent = readFileSync(fullPath, 'utf8')
    } catch {
      return { ok: false, message: `patch_target_read_failed ${targetPath}` }
    }

    const applied = applyWithHunkDiagnosis(sourceContent, parsedDiff)
    if (!applied.ok) {
      return { ok: false, message: applied.message }
    }

    nextContents.set(fullPath, applied.output)
  }

  if (!options.dryRun) {
    for (const [fullPath, content] of nextContents.entries()) {
      writeFileSync(fullPath, content, 'utf8')
    }
  }

  return { ok: true }
}

function reverseParsedPatch(parsed: ParsedPatch[]): ParsedPatch[] {
  const reversed = reversePatch(parsed)
  return Array.isArray(reversed) ? reversed : [reversed]
}

export function applyPatchToFile(patchContent: string, peerRoot: string): JsPatchResult {
  const parsed = parseAndNormalizePatch(patchContent)
  if (!parsed) {
    return { ok: false, message: 'patch_parse_failed' }
  }

  return runParsedPatch(parsed, peerRoot)
}

export function revertPatchFromFile(patchContent: string, peerRoot: string): JsPatchResult {
  const parsed = parseAndNormalizePatch(patchContent)
  if (!parsed) {
    return { ok: false, message: 'patch_parse_failed' }
  }

  return runParsedPatch(reverseParsedPatch(parsed), peerRoot)
}

export function dryRunPatch(patchContent: string, peerRoot: string, options: DryRunOptions = {}): JsPatchResult {
  const parsed = parseAndNormalizePatch(patchContent)
  if (!parsed) {
    return { ok: false, message: 'patch_parse_failed' }
  }

  const patch = options.reverse ? reverseParsedPatch(parsed) : parsed
  return runParsedPatch(patch, peerRoot, { dryRun: true })
}
