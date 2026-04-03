# opencode-cc-camouflage Ownership Matrix

This document locks singular ownership for user-visible behavior in v1 of
`opencode-cc-camouflage`. Task 1 fixture locks remain authoritative:

- `not-claude-code-emulator` -> `5541e5c1cb0895cfd4390391dc642c74fc5d0a1a`
- `opencode-anthropic-auth` -> `6594dd1f1ff8b63342f83173d4477f8b549b4867`

`opencode-cc-camouflage` is a companion maintenance plugin. It is not an
emulator fork and it is not an auth-plugin fork.

## Ownership Rules

- Every user-visible behavior has exactly one owner.
- Cross-project integration may exist, but responsibility does not float.
- If behavior spans multiple components, the owner below remains the final
  authority for the v1 contract.

## Behavior Matrix

| User-visible behavior | Single owner | Why this owner is locked |
| --- | --- | --- |
| Anthropic-compatible message runtime | `not-claude-code-emulator` @ `5541e5c1cb0895cfd4390391dc642c74fc5d0a1a` | Runtime request and response behavior belongs to the emulator fixture, so `opencode-cc-camouflage` must treat it as an upstream dependency instead of re-owning message execution semantics. |
| Auth loader and transform semantics | `opencode-anthropic-auth` @ `6594dd1f1ff8b63342f83173d4477f8b549b4867` | Token loading, auth wiring, and transform behavior are owned by the auth plugin fixture; camouflage may integrate with it but may not redefine its semantics. |
| Peer detection | `opencode-cc-camouflage` | Detecting the local companion plugin environment and deciding whether the peer installation is present is plugin-specific orchestration, not upstream runtime or auth behavior. |
| Doctor and status UX | `opencode-cc-camouflage` | User-facing maintenance and health reporting are the companion plugin surface and must stay in this repo rather than inside the emulator or auth plugin. |
| Patch inventory | `opencode-cc-camouflage` | Tracking which maintenance patches exist, which are applicable, and which are intentionally excluded is a plugin-owned maintenance concern. |
| Patch apply and revert orchestration | `opencode-cc-camouflage` | The companion plugin owns orchestration over apply and revert flows while still consuming the locked upstream fixtures as inputs. |
| Verify-only automatic hooks | `opencode-cc-camouflage` | Automatic verify-only hooks are a local maintenance policy surface and therefore belong to this repo, not to the emulator fixture and not to the auth plugin fixture. |

## Scope Boundary

- `opencode-cc-camouflage` may observe or coordinate upstream components, but it
  does not take over emulator runtime semantics or auth transform semantics.
- Any later implementation task that conflicts with this matrix must be treated
  as out of scope for v1 unless this document is deliberately revised.
