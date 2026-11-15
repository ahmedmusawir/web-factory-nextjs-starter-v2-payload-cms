#!/usr/bin/env bash
# Fail-closed Cloud Build SOURCE UPLOAD boundary; protects gcloud context (not just Docker).
set -euo pipefail
source_dir="${1:-}"
if [[ -z "$source_dir" || ! -d "$source_dir" ]]; then
  echo 'BLOCKED: specify the EXACT Cloud Build submission directory.' >&2; exit 2
fi
listing=$(mktemp)
trap 'rm -f "$listing"' EXIT
if [[ "${2:-}" == '--fixture-file' ]]; then
  # Offline regression only: NEVER use this mode as live Cloud Build authorization.
  cp -- "${3:?fixture path required}" "$listing"
else
  if ! (cd "$source_dir" && gcloud meta list-files-for-upload .) >"$listing" 2>/dev/null; then
    echo 'BLOCKED: gcloud effective upload listing failed; no build submission.' >&2; exit 2
  fi
fi
if [[ ! -s "$listing" ]]; then
  echo 'BLOCKED: effective upload listing empty.' >&2; exit 2
fi
pattern='(^|/)\.env[^/]*($|/)|(^|/)\.(npmrc|pypirc|netrc|git-credentials)($|/)|(^|/)\.(ssh|aws|gnupg|git)($|/)|\.(pem|p12|pfx|key|sqlite|sqlite3|db)$|(^|/)[^/]*(service[-_]?account|credentials)[^/]*\.json$|(^|/)id_(rsa|ed25519)($|/)|(^|/)\.npm/_auth'
if LC_ALL=C grep -Ei "$pattern" "$listing" >/dev/null; then
  echo 'BLOCKED: sensitive path(s) in Cloud Build upload:' >&2
  LC_ALL=C grep -Ei "$pattern" "$listing" >&2
  exit 3
fi
printf 'UPLOAD BOUNDARY PASS: %s effective source files; no known sensitive filenames.\n' "$(wc -l <"$listing")"
echo 'NOTE: this does not scan file CONTENTS for hardcoded secrets.'
