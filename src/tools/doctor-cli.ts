import { runDoctorTool } from './doctor'

function main(): number {
  const result = runDoctorTool()
  process.stdout.write(`${result.output}\n`)
  return result.exitCode
}

process.exitCode = main()
