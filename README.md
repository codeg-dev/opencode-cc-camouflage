# opencode-cc-camouflage

> [!WARNING]
> **This repository is archived.**
>
> The upstream emulator `not-claude-code-emulator` was archived and stopped
> successfully spoofing Anthropic around midnight KST on 2026-04-06. Without a
> working emulator the patch lifecycle this plugin maintains has no effect.
> This repository is therefore also archived and is no longer maintained.
> No further updates or bug fixes will be issued.

<p align="center">
  <strong>English</strong> |
  <a href="README.es.md">Español</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.vi.md">Tiếng Việt</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a>
</p>

A companion maintenance plugin for OpenCode that helps verify, apply, and revert
patches related to the Anthropic auth plugin. This package is not a fork of
upstream projects. It provides explicit tooling without automatic hooks.

## What this is

`opencode-cc-camouflage` is a maintenance plugin that:

- Verifies patch safety before any modifications
- Applies patches to the peer plugin when you explicitly request it
- Reverts patches when you need to roll back
- Reports status and provides diagnostic guidance

It does not automatically patch during install. All mutation requires explicit
tool invocation.

## Prerequisites and install order

The install order matters. You must have the following in place before this
plugin can function:

1. **`not-claude-code-emulator`** (commit `5541e5c`)
   - The message runtime that provides Anthropic-compatible interfaces
   - Install via npm: `npm install -g not-claude-code-emulator`
   - Or clone into `~/github/not-claude-code-emulator`

2. **`opencode-anthropic-auth`** (commit `6594dd1`)
   - The peer plugin that handles Anthropic OAuth
   - Install as an OpenCode plugin alongside this package

3. **`opencode-cc-camouflage`** (this package)
   - Install last, after the emulator and peer plugin are present

See [docs/install.md](docs/install.md) for detailed steps and the
`CC_CAMOUFLAGE_EMULATOR_ROOT` environment variable configuration.

## Available tools

This plugin exposes four explicit tools. They are not automatic hooks.

### `status`

Reports the current state of the peer installation.

```bash
bun run status
```

Output format is machine-readable:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

Exit code 0 means healthy. Exit code 1 means something needs attention.

### `doctor`

Provides diagnostic guidance based on the current state.

```bash
bun run doctor
```

This inspects files and reports actionable next steps. It does not install,
patch, or modify anything. It only reads and reports.

### `patch_apply`

Applies the pinned patch to the peer plugin.

```bash
bun run patch:apply
```

This requires:
- The peer plugin to be present
- The patch preflight checks to pass
- A writable peer root

It creates rollback markers before modifying files.

### `patch_revert`

Reverts a previously applied patch.

```bash
bun run patch:revert
```

This uses rollback markers to restore the pre-patch state. Markers must match
the current patch hash for revert to proceed.

## Why automatic hooks are verify-only

Automatic hooks (`command.execute.before`, `tool.execute.after`) in this plugin
are limited to verification and metadata only. They do not apply patches
automatically because:

1. Mutating a peer plugin without explicit user intent violates the principle
   of least surprise
2. Patching failures need human review, not silent retries
3. Rollback requires explicit consent to restore state

The hooks warn when drift is detected. You decide whether to apply, revert, or
leave the environment unchanged.

## Platform support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS    | Supported | Primary desktop environment |
| Linux    | Supported | Same pinned upstream fixtures |
| Windows  | Supported | Supports drive-letter and backslash-based plugin discovery |

See [docs/support-matrix.md](docs/support-matrix.md) for the locked fixture
versions.

## Rollback

If you need to undo a patch application:

```bash
bun run patch:revert
```

See [docs/rollback.md](docs/rollback.md) for concrete steps and troubleshooting.

## Compatibility canary

To check for upstream drift against pinned targets:

```bash
bun run compat:canary
```

This is a read-only check that validates fixture integrity and upstream
references without modifying anything. It exits 0 on pinned supported targets.

See [docs/next-release.md](docs/next-release.md) for details on the canary
workflow.

## Documentation

- [docs/announcement.md](docs/announcement.md) - Archival announcement and tweet text
- [docs/install.md](docs/install.md) - Prerequisites and install steps
- [docs/rollback.md](docs/rollback.md) - Concrete rollback steps
- [docs/compatibility.md](docs/compatibility.md) - Compatibility boundaries
- [docs/next-release.md](docs/next-release.md) - Upstream drift canary
- [docs/support-matrix.md](docs/support-matrix.md) - Locked fixture versions
- [docs/non-goals.md](docs/non-goals.md) - Explicit out-of-scope items
- [docs/patch-inventory.md](docs/patch-inventory.md) - Patch asset classification
- [docs/upstream-locks.md](docs/upstream-locks.md) - Dev fixture references

## Development

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Run tests
bun run test:unit
bun run test:integration

# Verify patches against fixtures
bun run verify:patches

# Check publish safety
bun run check:publish-safety
```

## License

MIT
