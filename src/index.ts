import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'

import type { Hooks, Plugin, PluginModule, ToolContext, ToolDefinition } from './plugin-api'
import { tool } from './plugin-api'

import { runPatchApply } from './patch/apply'
import { resolveRepoRoot } from './patch/manifest'
import { runPatchRevert } from './patch/revert'
import { prepareManagedPatchSandbox } from './patch/sandbox'
import { runDoctorTool } from './tools/doctor'
import { runStatusTool } from './tools/status'

export const pluginName = 'opencode-cc-camouflage'

export const explicitToolIds = ['status', 'doctor', 'patch_apply', 'patch_revert'] as const
export const verifyOnlyToolIds = ['status', 'doctor'] as const

export const verifyOnlyCommandNote = [
  'opencode-cc-camouflage automatic hooks are verify-only.',
  'They may add safety context, but they never apply or revert patches automatically and never touch auth or token state.',
  'Use the explicit tools status, doctor, patch_apply, and patch_revert when you want maintenance actions.',
].join(' ')

type ExplicitToolId = (typeof explicitToolIds)[number]
type VerifyOnlyToolId = (typeof verifyOnlyToolIds)[number]

type MaintenanceArgs = {
  homeDir?: string
  cwd?: string
  platform?: string
}

type ToolMetadata = Parameters<ToolContext['metadata']>[0]

const explicitToolIdSet = new Set<string>(explicitToolIds)
const verifyOnlyToolIdSet = new Set<string>(verifyOnlyToolIds)

function buildMaintenanceArgs() {
  return {
    homeDir: tool.schema.string().optional().describe('Optional HOME override for diagnostics or managed sandbox runs.'),
    cwd: tool.schema.string().optional().describe('Optional working-directory override for peer discovery.'),
    platform: tool.schema.string().optional().describe('Optional platform override for verification flows.'),
  }
}

function resolveMaintenanceArgs(args: MaintenanceArgs, context: ToolContext) {
  return {
    homeDir: args.homeDir ?? homedir(),
    cwd: args.cwd ?? context.directory,
    platform: args.platform,
  }
}

function setToolMetadata(context: ToolContext, title: string, metadata: ToolMetadata['metadata']) {
  context.metadata({
    title,
    metadata: {
      plugin: pluginName,
      ...metadata,
    },
  })
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return { ...(value as Record<string, unknown>) }
}

function isMaintenanceCommand(command: string, argumentsText: string): boolean {
  if (explicitToolIdSet.has(command)) {
    return true
  }

  return explicitToolIds.some((toolId) => argumentsText.includes(toolId))
}

function createSyntheticWarningPart(sessionID: string) {
  const stamp = Date.now()

  return {
    id: `${pluginName}:${randomUUID()}`,
    sessionID,
    messageID: `${pluginName}:command.execute.before:${randomUUID()}`,
    type: 'text' as const,
    text: verifyOnlyCommandNote,
    synthetic: true,
    time: {
      start: stamp,
      end: stamp,
    },
    metadata: {
      plugin: pluginName,
      verifyOnly: true,
      mutated: false,
    },
  }
}

function buildStatusTool() {
  return {
    description: 'Report machine-readable maintenance status for the peer plugin. Read-only.',
    args: buildMaintenanceArgs(),
    async execute(args: MaintenanceArgs, context: ToolContext) {
      const options = resolveMaintenanceArgs(args, context)
      const result = runStatusTool(options)

      setToolMetadata(context, 'Camouflage Status', {
        tool: 'status',
        verifyOnly: true,
        mutated: false,
        exitCode: result.exitCode,
      })

      return result.output
    },
  } satisfies ToolDefinition<MaintenanceArgs>
}

function buildDoctorTool() {
  return {
    description: 'Explain the current maintenance diagnosis and next steps without changing files or auth state.',
    args: buildMaintenanceArgs(),
    async execute(args: MaintenanceArgs, context: ToolContext) {
      const options = resolveMaintenanceArgs(args, context)
      const result = runDoctorTool(options)

      setToolMetadata(context, 'Camouflage Doctor', {
        tool: 'doctor',
        verifyOnly: true,
        mutated: false,
        diagnosis: result.diagnosis,
        exitCode: result.exitCode,
      })

      return result.output
    },
  } satisfies ToolDefinition<MaintenanceArgs>
}

function buildPatchApplyTool() {
  return {
    description: 'Explicitly apply the pinned peer patch. This tool never runs automatically from hooks.',
    args: buildMaintenanceArgs(),
    async execute(args: MaintenanceArgs, context: ToolContext) {
      const repoRoot = resolveRepoRoot()
      const options = resolveMaintenanceArgs(args, context)

      prepareManagedPatchSandbox({ homeDir: options.homeDir, repoRoot })
      const result = runPatchApply({ ...options, repoRoot })

      setToolMetadata(context, 'Camouflage Patch Apply', {
        tool: 'patch_apply',
        verifyOnly: false,
        explicitMutation: true,
        exitCode: result.exitCode,
        patchState: result.state,
      })

      return result.output
    },
  } satisfies ToolDefinition<MaintenanceArgs>
}

function buildPatchRevertTool() {
  return {
    description: 'Explicitly revert the pinned peer patch using the rollback marker. This tool never runs automatically from hooks.',
    args: buildMaintenanceArgs(),
    async execute(args: MaintenanceArgs, context: ToolContext) {
      const repoRoot = resolveRepoRoot()
      const options = resolveMaintenanceArgs(args, context)

      prepareManagedPatchSandbox({ homeDir: options.homeDir, repoRoot })
      const result = runPatchRevert({ ...options, repoRoot })

      setToolMetadata(context, 'Camouflage Patch Revert', {
        tool: 'patch_revert',
        verifyOnly: false,
        explicitMutation: true,
        exitCode: result.exitCode,
        patchState: result.state,
      })

      return result.output
    },
  } satisfies ToolDefinition<MaintenanceArgs>
}

export function createServerHooks(): Hooks {
  return {
    tool: {
      status: buildStatusTool(),
      doctor: buildDoctorTool(),
      patch_apply: buildPatchApplyTool(),
      patch_revert: buildPatchRevertTool(),
    },
    'command.execute.before': async (input, output) => {
      if (!isMaintenanceCommand(input.command, input.arguments)) {
        return
      }

      output.parts.push(createSyntheticWarningPart(input.sessionID))
    },
    'tool.execute.after': async (input, output) => {
      if (!verifyOnlyToolIdSet.has(input.tool)) {
        return
      }

      const toolId = input.tool as VerifyOnlyToolId
      output.metadata = {
        ...normalizeMetadata(output.metadata),
        plugin: pluginName,
        tool: toolId,
        verifyOnly: true,
        mutated: false,
      }

      if (!output.title) {
        output.title = toolId === 'status' ? 'Camouflage Status' : 'Camouflage Doctor'
      }
    },
  }
}

export const server: Plugin = async () => createServerHooks()

export const pluginEntry: PluginModule = {
  id: pluginName,
  server,
}

export const plugin = pluginEntry

export function isExplicitToolId(value: string): value is ExplicitToolId {
  return explicitToolIdSet.has(value)
}

export default server
