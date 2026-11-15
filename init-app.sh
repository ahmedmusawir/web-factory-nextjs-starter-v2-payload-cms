#!/usr/bin/env bash
# Initial service verification, not required for routine redeployments.
set -euo pipefail
set +x
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$ROOT/ops/redeploy.py" init --repo "$ROOT" "$@"
