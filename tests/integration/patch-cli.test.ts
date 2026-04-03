import { describe, expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { createHomedirStubEnv, removeManagedHome } from '../helpers/temp-home'

const repoRoot = resolve(import.meta.dir, '..', '..')
const markerPath = join(repoRoot, '.tmp', 'patch-state', 'opencode-anthropic-auth.json')
const integrationTimeoutMs = 30_000

type PatchCliCommand = 'patch:apply' | 'patch:revert' | 'verify:patches'

type CliRun = {
  exitCode: number
  stdout: string
  stderr: string
  homeDir: string
}

function runPatchCli(
  command: PatchCliCommand,
  homeName: string,
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<CliRun> {
  const homeDir = join(repoRoot, '.tmp', homeName)

  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, ['run', command], {
      cwd: repoRoot,
      env: createHomedirStubEnv(homeDir, {
        ...process.env,
        CC_CAMOUFLAGE_PATCH_HOME: homeDir,
        CC_CAMOUFLAGE_VERIFY_HOME: homeDir,
        ...extraEnv,
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

async function cleanupManagedState(homeName: string): Promise<void> {
  await rm(markerPath, { force: true })
  await removeManagedHome(join(repoRoot, '.tmp', homeName))
}

describe('patch CLI flows', () => {
  test('CLI apply, verify, idempotent apply, and revert stay consistent with the JS engine', async () => {
    const homeName = 'home-clean-cli'

    try {
      await cleanupManagedState(homeName)

      const cleanVerify = await runPatchCli('verify:patches', homeName)
      expect(cleanVerify.exitCode).toBe(0)
      expect(cleanVerify.stdout).toContain('patch=clean')

      const firstApply = await runPatchCli('patch:apply', homeName)
      expect(firstApply.exitCode).toBe(0)
      expect(firstApply.stdout).toContain('patch=applied')
      expect(firstApply.stdout).toContain('marker=')

      const appliedVerify = await runPatchCli('verify:patches', homeName)
      expect(appliedVerify.exitCode).toBe(0)
      expect(appliedVerify.stdout).toContain('patch=applied')
      expect(appliedVerify.stdout).toContain('reason=reverse_patch_check_ok')

      const secondApply = await runPatchCli('patch:apply', homeName)
      expect(secondApply.exitCode).toBe(0)
      expect(secondApply.stdout).toContain('patch=already_applied')

      const revert = await runPatchCli('patch:revert', homeName)
      expect(revert.exitCode).toBe(0)
      expect(revert.stdout).toContain('patch=clean')

      const postRevertVerify = await runPatchCli('verify:patches', homeName)
      expect(postRevertVerify.exitCode).toBe(0)
      expect(postRevertVerify.stdout).toContain('patch=clean')
    } finally {
      await cleanupManagedState(homeName)
    }
  }, integrationTimeoutMs)

  test('CLI verify reports drift mismatches from the managed sandbox', async () => {
    const homeName = 'home-drift-cli'

    try {
      await cleanupManagedState(homeName)

      const verify = await runPatchCli('verify:patches', homeName)
      expect(verify.exitCode).toBe(1)
      expect(verify.stdout).toContain('patch=drift')
      expect(verify.stdout).toContain('mismatch=version_hash_mismatch')
    } finally {
      await cleanupManagedState(homeName)
    }
  }, integrationTimeoutMs)

  test('CLI patch flow stays supported under a win32 platform mock', async () => {
    const homeName = 'home-clean-win32-cli'
    const env = {
      CC_CAMOUFLAGE_PLATFORM: 'win32',
      CC_CAMOUFLAGE_EMULATOR_FALLBACK_PATHS: '~/github/not-claude-code-emulator',
    }

    try {
      await cleanupManagedState(homeName)

      const verify = await runPatchCli('verify:patches', homeName, env)
      expect(verify.exitCode).toBe(0)
      expect(verify.stdout).toContain('support=supported')
      expect(verify.stdout).toContain('patch=clean')

      const apply = await runPatchCli('patch:apply', homeName, env)
      expect(apply.exitCode).toBe(0)
      expect(apply.stdout).toContain('patch=applied')

      const revert = await runPatchCli('patch:revert', homeName, env)
      expect(revert.exitCode).toBe(0)
      expect(revert.stdout).toContain('patch=clean')
    } finally {
      await cleanupManagedState(homeName)
    }
  }, integrationTimeoutMs)
})
