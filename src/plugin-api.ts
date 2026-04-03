export type ToolMetadataPayload = {
  title: string
  metadata?: Record<string, unknown>
}

export type ToolContext = {
  sessionID: string
  messageID: string
  agent: string
  directory: string
  worktree: string
  abort: AbortSignal
  metadata: (input: ToolMetadataPayload) => void
  ask: (...args: unknown[]) => Promise<unknown> | void
}

export type TextPart = {
  id?: string
  sessionID?: string
  messageID?: string
  type: 'text'
  text: string
  synthetic?: boolean
  time?: {
    start: number
    end: number
  }
  metadata?: Record<string, unknown>
}

export type ToolDefinition<Args extends Record<string, unknown> = Record<string, unknown>> = {
  description: string
  args?: Record<string, unknown>
  execute: (args: Args, context: ToolContext) => Promise<string> | string
}

export type Hooks = {
  tool?: Record<string, ToolDefinition>
  'command.execute.before'?: (
    input: {
      command: string
      sessionID: string
      arguments: string
    },
    output: {
      parts: TextPart[]
    },
  ) => Promise<void> | void
  'tool.execute.after'?: (
    input: {
      tool: string
      sessionID: string
      callID: string
      args: Record<string, unknown>
    },
    output: {
      title?: string
      output: string
      metadata?: Record<string, unknown>
    },
  ) => Promise<void> | void
  'experimental.chat.system.transform'?: unknown
}

export type Plugin = () => Promise<Hooks> | Hooks

export type PluginModule = {
  id: string
  server: Plugin
}

export type SchemaString = {
  type: 'string'
  required: boolean
  description?: string
  optional: () => SchemaString
  describe: (text: string) => SchemaString
}

function createSchemaString(required = true, description?: string): SchemaString {
  return {
    type: 'string',
    required,
    description,
    optional: () => createSchemaString(false, description),
    describe: (text) => createSchemaString(required, text),
  }
}

type ToolFactory = {
  schema: {
    string: () => SchemaString
  }
  <Args extends Record<string, unknown>>(definition: ToolDefinition<Args>): ToolDefinition<Args>
}

export const tool: ToolFactory = Object.assign(
  <Args extends Record<string, unknown>>(definition: ToolDefinition<Args>) => definition,
  {
    schema: {
      string: () => createSchemaString(),
    },
  },
)
