# Installation Guide

This document explains how to install `opencode-cc-camouflage` and its
prerequisites.

## Prerequisites

You need three components installed in order:

1. `not-claude-code-emulator` - Message runtime
2. `opencode-anthropic-auth` - Peer auth plugin
3. `opencode-cc-camouflage` - This maintenance plugin

## Step 1: Install the emulator

You have two options for installing the emulator:

### Option A: npm global install (recommended)

The easiest way to install the emulator:

```bash
npm install -g not-claude-code-emulator
```

### Option B: git clone (still supported)

Clone the message runtime that provides Anthropic-compatible interfaces:

```bash
cd ~/github
git clone https://github.com/code-yeongyu/not-claude-code-emulator.git
cd not-claude-code-emulator
git checkout 5541e5c1cb0895cfd4390391dc642c74fc5d0a1a
```

This specific commit is the pinned v1 target. Do not use a different version
unless you understand the compatibility implications.

Both methods are supported. npm global install is recommended for simplicity.

### Environment variable

If you installed via npm global, set the environment variable to tell the
plugin where to find the emulator:

```bash
export CC_CAMOUFLAGE_EMULATOR_ROOT=$(npm root -g)/not-claude-code-emulator
```

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.) for persistence.

## Step 2: Install the peer plugin

Clone the auth plugin that handles Anthropic OAuth:

```bash
cd ~/github
git clone https://github.com/ex-machina-co/opencode-anthropic-auth.git
cd opencode-anthropic-auth
git checkout 6594dd1f1ff8b63342f83173d4477f8b549b4867
```

Install it as an OpenCode plugin. The exact method depends on your OpenCode
setup:

```bash
# If using local-folder plugin discovery
# Add to your opencode.json or opencode.jsonc:
# {
#   "plugins": [
#     {
#       "name": "opencode-anthropic-auth",
#       "path": "~/github/opencode-anthropic-auth"
#     }
#   ]
# }
```

## Step 3: Install this plugin

Clone this repository:

```bash
cd ~/github
git clone https://github.com/codeg-dev/opencode-cc-camouflage.git
cd opencode-cc-camouflage
```

Install dependencies:

```bash
bun install
```

Install it as an OpenCode plugin alongside the peer:

```bash
# Add to your opencode.json or opencode.jsonc:
# {
#   "plugins": [
#     {
#       "name": "opencode-anthropic-auth",
#       "path": "~/github/opencode-anthropic-auth"
#     },
#     {
#       "name": "opencode-cc-camouflage",
#       "path": "~/github/opencode-cc-camouflage"
#     }
#   ]
# }
```

## Verify the installation

Run the status tool to check if everything is detected:

```bash
bun run status
```

Expected output for a healthy installation:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

Run the doctor tool for diagnostic guidance:

```bash
bun run doctor
```

If you see `missing-peer`, the peer plugin is not discoverable. Check your
OpenCode config and ensure the path is correct.

If you see `unsupported`, you are on a platform not covered by v1.

## OAuth source precedence

The OAuth precedence is fixed for companion-plugin troubleshooting:

1. Claude desktop cache
2. System keychain
3. OpenCode auth store fallback

On headless machines, or whenever Claude Safe Storage is unavailable, the desktop
cache and keychain are not treated as canonical. In that exception path, the
OpenCode auth store becomes the canonical fallback.

## Local-folder vs cache installs

This plugin supports both installation modes:

| Mode | Discovery | Notes |
|------|-----------|-------|
| local-folder | Config-declared path in opencode.json(c) | Preferred; exact path control |
| cache | OpenCode plugin cache heuristics | Fallback; may vary by setup |

Local-folder installs are prioritized. If you have both, the config-declared
path takes precedence.

## Platform notes

### macOS

Primary supported environment. All features work as documented.

### Linux

Supported with the same pinned upstream fixtures. The plugin uses standard
POSIX utilities (`patch`, `git apply`) that should be available on most
distributions.

### Windows

Supported in v1 for the same pinned fixtures. Config-declared paths and
`node_modules`-style discovery accept Windows drive letters and backslashes.

## Troubleshooting

### "peer=missing" after install

1. Check that `~/github/opencode-anthropic-auth` exists
2. Verify your OpenCode config includes the plugin path
3. Restart OpenCode to pick up config changes
4. Run `bun run doctor` for detailed diagnostics

### "patch=drift" after peer update

If you updated the peer plugin to a newer version, the pinned preflight checks
may no longer match. This is expected. Options:

1. Revert the peer to the pinned commit
2. Wait for this plugin to release updated patch metadata
3. Manually verify patch safety before applying

### "support=unsupported"

You are on an unsupported platform. For v1, macOS, Linux, and Windows are supported.
Do not proceed with patch workflows on unsupported platforms.

## Next steps

Once installed and healthy, you can:

- Run `bun run status` to check state
- Run `bun run doctor` for diagnostics
- Run OpenCode tool `patch_apply` to apply patches (when explicitly needed)
- Run OpenCode tool `patch_revert` to roll back

See [rollback.md](rollback.md) for detailed rollback procedures.
