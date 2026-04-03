# Rollback Guide

This document provides concrete steps for rolling back patch changes.

## When to roll back

You should consider rolling back when:

1. A patch application caused unexpected behavior
2. You need to update the peer plugin to a newer version
3. You are debugging and need a clean baseline
4. The doctor tool reports `drift` and you want to restore known state

## Rollback methods

### Method 1: Using patch_revert (recommended)

The `patch:revert` tool uses rollback markers to restore files to their
pre-patch state:

```bash
bun run patch:revert
```

This will:
1. Verify rollback markers exist and are valid
2. Verify the marker patch hash matches the current patch
3. Restore files from the marker backup
4. Remove the markers after successful restore

Requirements:
- Rollback markers must exist (created during `patch:apply`)
- The patch hash in the marker must match the current patch
- The peer root must be writable

### Method 2: Using git checkout

If the peer plugin is a git repository and you have not committed the patched
state:

```bash
cd ~/github/opencode-anthropic-auth
git checkout -- src/index.ts
```

This discards changes to the specified file. Add more files as needed.

To reset all changes:

```bash
cd ~/github/opencode-anthropic-auth
git checkout -- .
```

### Method 3: Re-cloning the peer

For a complete reset when git state is messy:

```bash
# Backup any local changes you want to keep
cp -r ~/github/opencode-anthropic-auth ~/github/opencode-anthropic-auth.backup

# Remove and re-clone
rm -rf ~/github/opencode-anthropic-auth
cd ~/github
git clone https://github.com/ex-machina-co/opencode-anthropic-auth.git
cd opencode-anthropic-auth
git checkout 6594dd1f1ff8b63342f83173d4477f8b549b4867
```

This gives you a completely clean peer at the pinned commit.

## Verification after rollback

After any rollback method, verify the state:

```bash
# Check status
bun run status

# Expected output for clean state
# peer=present
# emulator=present
# patch=clean
# install_mode=local-folder
# support=supported

# Run doctor for confirmation
bun run doctor

# Expected: diagnosis=clean
```

If status shows `patch=drift` after rollback, the rollback may be incomplete.
Check the peer files against the fixture expectations.

## Troubleshooting rollback

### "No rollback markers found"

The `patch:revert` tool requires markers created during `patch:apply`. If you
did not use `patch:apply` (e.g., you patched manually), use Method 2 or 3
instead.

### "Patch hash mismatch"

The rollback marker was created for a different patch version. This can happen
if:
- You updated this plugin after applying patches
- The patch file changed

Options:
1. Use Method 2 (git checkout) if the peer is a clean git checkout
2. Use Method 3 (re-clone) for a complete reset
3. Manually inspect and restore files

### "Read-only path detected"

The peer root or a parent directory is not writable. Check permissions:

```bash
ls -la ~/github/opencode-anthropic-auth
```

Fix permissions or run from a writable location.

### Rollback succeeded but status still shows drift

The preflight checks in `patches/manifest.json` may not match even after file
restore. This can happen if:
- The peer was at a different commit when patched
- Other files besides the patched ones were modified

Run the doctor tool to see detailed diagnostics:

```bash
bun run doctor
```

If the drift is unexpected, consider Method 3 (re-clone) for a clean state.

## Preventing rollback needs

To minimize rollback scenarios:

1. Always run `bun run verify:patches` before applying
2. Check the doctor output before patching
3. Keep the peer at the pinned commit unless you understand the implications
4. Use `patch:apply` instead of manual patching to ensure markers are created

## Emergency recovery

If everything is broken and you need a known-good state:

```bash
# 1. Remove the peer entirely
rm -rf ~/github/opencode-anthropic-auth

# 2. Re-clone at pinned commit
cd ~/github
git clone https://github.com/ex-machina-co/opencode-anthropic-auth.git
cd opencode-anthropic-auth
git checkout 6594dd1f1ff8b63342f83173d4477f8b549b4867

# 3. Verify clean state
cd ~/github/opencode-cc-camouflage
bun run status
bun run doctor
```

This is the nuclear option but guarantees a clean starting point.
