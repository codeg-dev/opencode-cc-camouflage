import { describe, expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'

import { createHomedirStubEnv, removeManagedHome } from '../helpers/temp-home'

const repoRoot = resolve(import.meta.dir, '..', '..')
const integrationTimeoutMs = 30_000

type SmokeRun = {
  exitCode: number
  stdout: string
  stderr: string
  homeDir: string
}

function runSmoke(homeName: string): Promise<SmokeRun> {
  const homeDir = join(repoRoot, '.tmp', homeName)

  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, ['run', 'smoke:peer-auth'], {
      cwd: repoRoot,
      env: createHomedirStubEnv(homeDir, {
        ...process.env,
        CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS: '~/github/not-claude-code-emulator',
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', (code) => {
      resolveRun({
        exitCode: code ?? 1,
        stdout,
        stderr,
        homeDir,
      })
    })
  })
}

describe('doctor smoke harness', () => {
  test('clean managed home exits 0 with actionable output', async () => {
    const homeName = 'home-clean-doctor-it'

    try {
      const result = await runSmoke(homeName)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('doctor=clean')
      expect(result.stdout).toContain('No repair is required right now.')
      expect(result.stderr).not.toContain('readonly_check=sandbox-mutated')
    } finally {
      await removeManagedHome(join(repoRoot, '.tmp', homeName))
    }
  }, integrationTimeoutMs)

  test('missing peer managed home prints install hint', async () => {
    const homeName = 'home-missing-peer-doctor-it'

    try {
      const result = await runSmoke(homeName)
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain('doctor=missing-peer')
      expect(result.stdout).toContain('@ex-machina/opencode-anthropic-auth')
    } finally {
      await removeManagedHome(join(repoRoot, '.tmp', homeName))
    }
  }, integrationTimeoutMs)

  test('unsupported managed home explains platform limit', async () => {
    const homeName = 'home-unsupported-doctor-it'

    try {
      const result = await runSmoke(homeName)
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain('doctor=unsupported')
      expect(result.stdout).toContain('supported platform (macOS, Linux, or Windows)')
    } finally {
      await removeManagedHome(join(repoRoot, '.tmp', homeName))
    }
  }, integrationTimeoutMs)

  test('drift managed home points to manifest follow-up', async () => {
    const homeName = 'home-drift-doctor-it'

    try {
      const result = await runSmoke(homeName)
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain('doctor=drift')
      expect(result.stdout).toContain('pinned preflight checks')
    } finally {
      await removeManagedHome(join(repoRoot, '.tmp', homeName))
    }
  }, integrationTimeoutMs)

  test('readonly managed home stays unchanged', async () => {
    const homeName = 'home-readonly-doctor-it'

    try {
      const result = await runSmoke(homeName)
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain('doctor=readonly')
      expect(result.stdout).toContain('Read-only path detected')
      expect(result.stdout).toContain('readonly_check=sandbox-unchanged')
    } finally {
      await removeManagedHome(join(repoRoot, '.tmp', homeName))
    }
  }, integrationTimeoutMs)
})
