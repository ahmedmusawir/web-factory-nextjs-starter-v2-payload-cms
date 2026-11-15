#!/usr/bin/env bash
# Permanent in-repository, one-command PUBLIC redeployment entry point.
# This script and ops/redeploy.py travel with the WEBSITE repo, not the skill.
set -euo pipefail
set +x
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$ROOT/ops/redeploy.py" deploy --repo "$ROOT" "$@"
