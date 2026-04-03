import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { resolveRepoRoot } from '../patch/manifest'
import { prepareManagedPatchSandbox } from '../patch/sandbox'
import { runPatchVerify } from '../patch/verify'

function resolveVerifyHome(repoRoot: string): string {
  const overrideHome =
    process.env.CC_CAMOUFLAGE_VERIFY_HOME?.trim() ??
    process.env.CC_CAMOUFLAGE_PATCH_HOME?.trim() ??
    process.env.CC_CAMOUFLAGE_HOME?.trim()
  if (overrideHome) {
    return overrideHome
  }

  const managedRoot = join(repoRoot, '.tmp')
  const envHome = homedir()
  if (envHome) {
    const resolvedHome = resolve(envHome)
    if (resolvedHome === managedRoot || resolvedHome.startsWith(`${managedRoot}/`)) {
      return envHome
    }
  }

  return join(managedRoot, 'home-clean-verify')
}

function main(): number {
  const repoRoot = resolveRepoRoot()
  const homeDir = resolveVerifyHome(repoRoot)
  prepareManagedPatchSandbox({ homeDir, repoRoot })

  const result = runPatchVerify({ homeDir, repoRoot })
  process.stdout.write(`${result.output}\n`)
  return result.exitCode
}

process.exitCode = main()
