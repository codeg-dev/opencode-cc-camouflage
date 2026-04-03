# Next-Release Canary

This document describes the compatibility canary that detects upstream drift
without mutating anything.

## Purpose

The next-release canary:

1. Validates fixture integrity against pinned SHAs
2. Detects upstream manifest drift
3. Reports compatibility status without auto-opening PRs
4. Exits 0 on pinned supported targets (CI gate)

It is read-only by design. It never modifies upstream repositories or opens
pull requests.

## Running the canary

Local execution:

```bash
bun run compat:canary
```

CI execution (via GitHub Actions):

```bash
# Triggered automatically on pushes to main
# Manual trigger: Actions tab -> Compat Canary -> Run workflow
```

## What it checks

The canary performs these validations:

1. **Fixture existence** - All fixture files in `patches/manifest.json` exist
2. **SHA256 integrity** - Fixture content matches locked hashes
3. **Manifest validity** - JSON structure is valid and complete
4. **Upstream reference alignment** - Locked commits match expected values
5. **Platform support** - Current platform is in the support matrix

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed; environment is compatible |
| 1 | One or more checks failed; drift detected |
| 2 | Configuration or environment error |

## Understanding failures

### "Fixture file missing"

A fixture referenced in the manifest does not exist on disk. Run:

```bash
bun run verify:patches:fixture
```

To regenerate fixtures, you would need to update the manifest with new SHA
values and capture new fixture snapshots. This is outside the scope of the
read-only canary.

### "SHA256 mismatch"

A fixture file exists but its content differs from the locked hash. This
indicates:

1. The fixture was modified locally
2. The upstream repository changed
3. The file was corrupted

The canary reports the mismatch but does not attempt repair.

### "Upstream SHA mismatch"

The locked commit in the manifest does not match a configured expectation.
This is a metadata drift that requires manual review.

### "Platform unsupported"

The canary is running on an unrecognized platform. v1 supports macOS, Linux,
and Windows only.

## CI integration

The canary runs in GitHub Actions on:

- Every push to `main`
- Every pull request
- Manual workflow dispatch

It uses the same pinned fixtures as local runs. The CI environment is
configured to fail the workflow if the canary exits non-zero.

## Canary workflow file

The workflow is defined in `.github/workflows/compat-canary.yml`:

```yaml
name: Compat Canary
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  canary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run compat:canary
```

## Scope limitations

The canary explicitly does NOT:

- Clone upstream repositories
- Compare against live upstream HEAD
- Open pull requests
- Auto-apply patches
- Modify any files

It only validates the local fixture and manifest state against locked
expectations.

## When drift is expected

Drift is expected when:

1. You intentionally updated the peer plugin
2. Upstream released a new version
3. You are testing against a different commit

In these cases, the canary failure is informational. You decide whether to:

1. Update the manifest and fixtures
2. Revert the peer to the pinned commit
3. Override the check (not recommended for CI)

## Related documentation

- [compatibility.md](compatibility.md) - Compatibility boundaries
- [support-matrix.md](support-matrix.md) - Locked fixture versions
- [install.md](install.md) - Installation prerequisites
