# Support Matrix

This document locks the v1 support contract for `opencode-cc-camouflage`.
Version drift is not allowed in this scope: v1 is pinned to the exact Task 1
fixture locks below.

- `not-claude-code-emulator` -> `5541e5c1cb0895cfd4390391dc642c74fc5d0a1a`
- `opencode-anthropic-auth` -> `6594dd1f1ff8b63342f83173d4477f8b549b4867`

## Prerequisites

- **Node.js** - Required for all platforms. Install from [nodejs.org](https://nodejs.org/) or use a version manager.

## Platform Support

| Area | v1 status | Notes |
| --- | --- | --- |
| macOS | Supported | Primary supported desktop environment for local plugin maintenance flows. |
| Linux | Supported | Supported for local plugin maintenance flows with the same pinned upstream fixtures. |
| Windows | Supported | Supported for local plugin maintenance flows, including drive-letter and backslash path discovery. |

## Toolchain Support

| Area | v1 status | Notes |
| --- | --- | --- |
| Bun | required for development and test | Bun is the development and test toolchain for v1. |
| Node.js-only workflow | not a v1 support target | Documentation and verification should not imply an alternate Node-only development contract. |

## Installation Boundary

- Package-style plugin distribution may exist later, but v1 must also handle
  local-folder plugin installs.
- Local-folder installs must either be supported end to end or fail explicitly
  with a clear reason; v1 documentation must not imply a cache-only install
  model.
- Plugin coexistence assumptions must remain compatible with the pinned
  upstream fixtures above.

## Support Notes

- v1 support is limited to companion-plugin maintenance behavior owned by
  `opencode-cc-camouflage`.
- v1 support remains limited to the platforms listed above; other platforms
  outside this locked contract remain unsupported.
