# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-03

### Added

- `patch_apply` tool — Applies the pinned patch to `opencode-anthropic-auth` after preflight checks pass
- `patch_revert` tool — Reverts a previously applied patch using rollback markers
- `status` tool — Reports current peer plugin state (present/missing, patch clean/applied/drift)
- `doctor` tool — Provides diagnostic guidance based on current state without modifying anything
- Peer plugin discovery for macOS, Linux, and Windows plugin paths
- Emulator detection via `CC_CAMOUFLAGE_EMULATOR_ROOT` and fallback paths
- Platform support matrix (macOS, Linux, Windows)
- Compatibility canary (`bun run compat:canary`) for upstream drift detection
- Publish safety verification ensuring no private fixtures or secrets in tarball

### Security

- OAuth refresh locking with Map-based deduplication to prevent concurrent token refresh races
- Retry logic with exponential backoff for transient network errors (ECONNRESET, ETIMEDOUT)
- `CC_CAMOUFLAGE_EMULATOR_BASE_URL` support for routing `/v1/messages` through emulator
- Explicit apply/revert lifecycle with rollback markers — no automatic patching on install

### Compatibility

Pinned upstream fixtures:
- `opencode-anthropic-auth` @ `6594dd1` (commit `6594dd1f1ff8b63342f83173d4477f8b549b4867`)
- `not-claude-code-emulator` @ `5541e5c` (commit `5541e5c1cb0895cfd4390391dc642c74fc5d0a1a`, reference-only)

[Unreleased]: https://github.com/opencode-cc/opencode-cc-camouflage/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/opencode-cc/opencode-cc-camouflage/releases/tag/v0.1.0
