export type PublishedTargetCheck = {
  targetPath: string
  fallbackPath?: string
  contains: string
}

export const publishedReferenceFixtureNames = ['not-claude-code-emulator'] as const

export const publishedPatchPreflightChecks: PublishedTargetCheck[] = [
  {
    targetPath: 'src/index.ts',
    fallbackPath: 'dist/index.js',
    contains: 'if (!auth.access || !auth.expires || auth.expires < Date.now())',
  },
  {
    targetPath: 'src/index.ts',
    fallbackPath: 'dist/index.js',
    contains: "grant_type: 'refresh_token'",
  },
]
