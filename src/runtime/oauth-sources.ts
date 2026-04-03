export type OAuthSourceKind =
  | 'claude-desktop-cache'
  | 'system-keychain'
  | 'opencode-auth-store'

export interface OAuthSourceResolutionOptions {
  hasClaudeSafeStorage?: boolean
  headless?: boolean
}

export interface OAuthSourceResolution {
  documentedPrecedence: readonly OAuthSourceKind[]
  effectivePrecedence: OAuthSourceKind[]
  canonicalSource: OAuthSourceKind
  headlessException: boolean
  notes: string[]
}

export const documentedOAuthSourcePrecedence = [
  'claude-desktop-cache',
  'system-keychain',
  'opencode-auth-store',
] as const satisfies readonly OAuthSourceKind[]

export function resolveOAuthSourceResolution(
  options: OAuthSourceResolutionOptions = {},
): OAuthSourceResolution {
  const hasClaudeSafeStorage = options.hasClaudeSafeStorage !== false
  const headlessException = options.headless === true || !hasClaudeSafeStorage

  if (headlessException) {
    return {
      documentedPrecedence: documentedOAuthSourcePrecedence,
      effectivePrecedence: ['opencode-auth-store'],
      canonicalSource: 'opencode-auth-store',
      headlessException: true,
      notes: [
        'Headless or no-safe-storage environments cannot treat desktop cache as canonical.',
        'Use the OpenCode auth store as the fallback canonical source and skip desktop-cache and keychain precedence.',
      ],
    }
  }

  return {
    documentedPrecedence: documentedOAuthSourcePrecedence,
    effectivePrecedence: [...documentedOAuthSourcePrecedence],
    canonicalSource: 'claude-desktop-cache',
    headlessException: false,
    notes: [
      'Headful environments with Claude Safe Storage follow the documented precedence order.',
    ],
  }
}
