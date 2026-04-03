import { homedir } from 'node:os'

import { runDoctorTool } from '../../src/tools/doctor'
import { runStatusTool } from '../../src/tools/status'
import { runTarballSmoke } from '../helpers/packed-artifact'
import { prepareScenarioFromHome } from '../helpers/peer-scenario'
import { snapshotTree } from '../helpers/temp-home'

const fromTarball = process.argv.includes('--from-tarball')
const statusOnly = process.argv.includes('--status-only')

async function main(): Promise<number> {
  const homeDir = homedir()
  if (!homeDir) {
    console.error('HOME is required')
    return 1
  }

  if (fromTarball) {
    const result = await runTarballSmoke(homeDir)
    console.log(result.statusOutput)

    if (result.doctorOutput) {
      console.log('')
      console.log(result.doctorOutput)
    }

    if (result.statusExitCode !== 0) {
      return result.statusExitCode
    }

    if (result.doctorExitCode !== 0) {
      return result.doctorExitCode ?? 1
    }

    return 0
  }

  const scenario = await prepareScenarioFromHome(homeDir, { resetHome: true })
  if (scenario === 'unsupported') {
    process.env.CC_CAMOUFLAGE_PLATFORM = 'freebsd'
  } else {
    delete process.env.CC_CAMOUFLAGE_PLATFORM
  }

  if (statusOnly) {
    const result = runStatusTool()
    console.log(result.output)
    return result.exitCode
  }

  const beforeSnapshot = scenario === 'readonly' ? await snapshotTree(homeDir) : undefined
  const result = runDoctorTool()
  console.log(result.output)

  if (scenario === 'readonly') {
    const afterSnapshot = await snapshotTree(homeDir)
    if (beforeSnapshot !== afterSnapshot) {
      console.error('readonly_check=sandbox-mutated')
      return 1
    }

    console.log('readonly_check=sandbox-unchanged')
  }

  return result.exitCode
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
