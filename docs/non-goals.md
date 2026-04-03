# v1 non-goals

This document locks the v1 non-goals for `opencode-cc-camouflage`.

v1 stays aligned with the exact Task 1 fixture locks:

- `not-claude-code-emulator` -> `5541e5c1cb0895cfd4390391dc642c74fc5d0a1a`
- `opencode-anthropic-auth` -> `6594dd1f1ff8b63342f83173d4477f8b549b4867`

`opencode-cc-camouflage` remains a companion maintenance plugin. The following
items are explicitly out of scope for v1.

## Locked non-goals

- Emulator fork: v1 must not fork `not-claude-code-emulator` or re-home the
  Anthropic-compatible message runtime into this repository.
- Auth-plugin fork: v1 must not fork `opencode-anthropic-auth` or replace its
  auth loader and transform semantics with a local copy.
- Binary patching: v1 must not patch upstream binaries as a supported primary
  strategy.
- Live OAuth CI: v1 must not require live OAuth credentials or live OAuth flows
  in CI.
- Generic multi-provider engine: v1 must not become a general provider-routing
  framework beyond the locked companion-plugin maintenance scope.
- Install-time mutation: v1 must not mutate peer installations during install.
  Any patching or maintenance action must remain an explicit runtime operation,
  not an install side effect.

## Boundary Consequences

- Future work may integrate with upstream projects, but integration does not
  permit absorbing upstream ownership.
- If a proposal requires breaking one of the non-goals above, it is outside the
  v1 contract until the project intentionally re-scopes it.
