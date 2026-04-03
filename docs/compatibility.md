# Compatibility

This document defines the compatibility boundaries for `opencode-cc-camouflage`.

## Pinned upstream fixtures

v1 is locked to specific upstream commits. These are not semver ranges. They
are exact SHAs.

| Upstream | Commit | Status |
|----------|--------|--------|
| `not-claude-code-emulator` | `5541e5c1cb0895cfd4390391dc642c74fc5d0a1a` | Fixture-locked |
| `opencode-anthropic-auth` | `6594dd1f1ff8b63342f83173d4477f8b549b4867` | Fixture-locked |

These commits are verified through SHA256 checksums in `patches/manifest.json`.
Any deviation from these fixtures is classified as drift.

## Platform compatibility

| Platform | v1 Status | Notes |
|----------|-----------|-------|
| macOS | Supported | Primary development and test environment |
| Linux | Supported | CI and server deployments |
| Windows | Supported | Drive-letter, backslash, and `node_modules` path discovery are supported |

Windows support is explicit. Config-declared paths and cache-style installs are
recognized with Windows drive letters and path separators.

## Toolchain compatibility

| Tool | Requirement | Notes |
|------|-------------|-------|
| Bun | Required | Development, test, and runtime |
| Node.js | Not supported | Do not attempt Node-only workflows |
| npm/pnpm/yarn | Not tested | Use Bun exclusively |

This package is built for Bun. While some parts may work with Node, this is
not a support target.

## Plugin compatibility

The peer plugin must be discoverable at one of these locations:

1. Config-declared path in `~/.config/opencode/opencode.json(c)`
2. OpenCode plugin cache under `~/.config/opencode/plugins/`

Local-folder installs (option 1) are preferred and prioritized over cache
discovery.

## Patch compatibility

Patches are compatible when:

1. The peer is at the pinned commit
2. The preflight checks in `patches/manifest.json` pass
3. The platform is supported

Patches are incompatible when:

1. The peer is at a different commit
2. The preflight checks fail (drift detected)
3. The platform is unsupported
4. The peer root is read-only

## What constitutes drift

Drift is detected when:

- The peer's `src/index.ts` does not contain the expected preflight anchors
- The fixture SHA256 values do not match the manifest
- The peer files differ from the locked baseline

Drift is not an error in itself. It is a signal that the environment differs
from the tested baseline. You decide how to proceed:

1. Revert the peer to the pinned commit
2. Manually verify and apply patches anyway
3. Wait for updated patch metadata

## Forward compatibility

This package does not promise forward compatibility with:

- Newer commits of upstream repositories
- Different patch formats
- Additional platforms
- Alternate toolchains

Each of these would require explicit testing and updated fixture locks.

## Patch engine changes

The patch engine implementation has changed from Unix `patch` command to a
pure JavaScript solution using `diff` (jsdiff). This change improves cross-
platform compatibility, especially on Windows where the `patch` binary may not
be available.

### What changed

| Before | After |
|--------|-------|
| System `patch` binary | `diff` npm package (jsdiff) |
| External dependency | JavaScript-native implementation |

### What stayed the same

- The same `.patch` files are used
- The same results are produced
- The same preflight checks are performed
- The same rollback markers are created

No behavioral changes. The patch application and revert workflows remain
identical.

## Checking compatibility

Run the compatibility canary to verify fixture integrity:

```bash
bun run compat:canary
```

This validates:
- Fixture files exist and have correct SHA256 values
- Manifest structure is valid
- Upstream references match the locked commits

Exit code 0 means the environment matches the pinned expectations.

## Compatibility matrix summary

| Component | Compatible Version | Detection Method |
|-----------|-------------------|------------------|
| Emulator | `5541e5c` | Fixture hash in manifest |
| Peer plugin | `6594dd1` | Preflight checks + fixture hash |
| Platform | macOS, Linux, Windows | `process.platform` |
| Toolchain | Bun latest | `bun --version` |

Any deviation from this matrix will be reported by `status`, `doctor`, or
`compat:canary` tools.
