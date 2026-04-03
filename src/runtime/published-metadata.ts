export type PublishedTargetCheck = {
  targetPath: string
  contains: string
}

export const publishedReferenceFixtureNames = ['not-claude-code-emulator'] as const

export const publishedPatchPreflightChecks: PublishedTargetCheck[] = [
  {
    targetPath: 'src/index.ts',
    contains: 'if (!auth.access || !auth.expires || auth.expires < Date.now())',
  },
  {
    targetPath: 'src/index.ts',
    contains: "grant_type: 'refresh_token'",
  },
]
