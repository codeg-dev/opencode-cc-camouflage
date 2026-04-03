import { runStatusTool } from './status'

function main(): number {
  const result = runStatusTool()
  process.stdout.write(`${result.output}\n`)
  return result.exitCode
}

process.exitCode = main()
