import { homedir } from 'node:os'

import { resolveRepoRoot } from '../patch/manifest'
import { runPatchRevert } from '../patch/revert'
import { prepareManagedPatchSandbox } from '../patch/sandbox'

function resolveRevertHome(): string {
  return process.env.CC_CAMOUFLAGE_PATCH_HOME?.trim() ?? process.env.CC_CAMOUFLAGE_HOME?.trim() ?? homedir()
}

function main(): number {
  const repoRoot = resolveRepoRoot()
  const homeDir = resolveRevertHome()
  prepareManagedPatchSandbox({ homeDir, repoRoot })

  const result = runPatchRevert({ homeDir, repoRoot })
  process.stdout.write(`${result.output}\n`)
  return result.exitCode
}

process.exitCode = main()
