import { homedir } from 'node:os'

import { runPatchApply } from '../patch/apply'
import { resolveRepoRoot } from '../patch/manifest'
import { prepareManagedPatchSandbox } from '../patch/sandbox'

function resolveApplyHome(): string {
  return process.env.CC_CAMOUFLAGE_PATCH_HOME?.trim() ?? process.env.CC_CAMOUFLAGE_HOME?.trim() ?? homedir()
}

function main(): number {
  const repoRoot = resolveRepoRoot()
  const homeDir = resolveApplyHome()
  prepareManagedPatchSandbox({ homeDir, repoRoot })

  const result = runPatchApply({ homeDir, repoRoot })
  process.stdout.write(`${result.output}\n`)
  return result.exitCode
}

process.exitCode = main()
