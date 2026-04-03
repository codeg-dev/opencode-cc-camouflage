#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/"
TARGET_DIR="/Volumes/DATA/github/opencode-cc-camouflage-public/"
MODE="apply"

if [[ "${1-}" == "--dry-run" ]]; then
  MODE="dry-run"
elif [[ -n "${1-}" ]]; then
  printf 'Unsupported option: %s\n' "$1" >&2
  printf 'Usage: %s [--dry-run]\n' "$(basename "$0")" >&2
  exit 1
fi

if [[ ! -f "${REPO_ROOT}/package.json" ]]; then
  printf 'package.json not found under %s\n' "${REPO_ROOT}" >&2
  exit 1
fi

if [[ ! -f "${REPO_ROOT}/AGENTS.md" ]]; then
  printf 'AGENTS.md not found under %s; refusing to sync unexpected directory\n' "${REPO_ROOT}" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"

RSYNC_ARGS=(
  -a
  --delete
  --exclude=.git/
  --exclude=node_modules/
  --exclude=dist/
  --exclude=coverage/
  --exclude=.DS_Store
  --exclude=.sisyphus/
  --exclude=.github/
  --exclude=.openchrome/
  --exclude=.opencode/
  --exclude=.claude/
  --exclude=.artifacts/
  --exclude=.tmp/
  --exclude=.env
  --exclude=.env.*
  --exclude=auth.json
  --exclude=auth*.json
  --exclude=AGENTS.md
  --exclude=CONTEXT.md
  --exclude=PRINCIPLES.md
  --exclude=korean/
  --exclude=fixtures/
  --exclude=LEGAL-DISCLAIMER.md
  --exclude=docs/upstream-locks.md
  --exclude=docs/patch-inventory.md
)

if [[ "${MODE}" == "dry-run" ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
fi

printf 'Sync mode: %s\n' "${MODE}"
printf 'Source: %s\n' "${SOURCE_DIR}"
printf 'Target: %s\n' "${TARGET_DIR}"

rsync "${RSYNC_ARGS[@]}" "${SOURCE_DIR}" "${TARGET_DIR}"

python3 - <<'PY'
from pathlib import Path

gitignore_path = Path("/Volumes/DATA/github/opencode-cc-camouflage-public/.gitignore")
if gitignore_path.exists():
    lines = gitignore_path.read_text().splitlines()
    filtered = []
    skip_local_runtime = False

    for line in lines:
        if line == "# Local runtime state":
            skip_local_runtime = True
            continue

        if skip_local_runtime:
            if line.startswith("# "):
                skip_local_runtime = False
            else:
                continue

        filtered.append(line)

    content = "\n".join(filtered).strip() + "\n"
    gitignore_path.write_text(content)
PY

if [[ "${MODE}" == "apply" ]]; then
  printf 'Public copy updated at %s\n' "${TARGET_DIR}"
fi
