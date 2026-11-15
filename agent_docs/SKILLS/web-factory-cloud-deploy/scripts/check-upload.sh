#!/usr/bin/env bash
set -euo pipefail
# Run from the exact dedicated tree that will be submitted to Cloud Build.
list_file=$(mktemp)
trap 'rm -f "$list_file"' EXIT
if ! gcloud meta list-files-for-upload . >"$list_file" 2>/dev/null; then
  echo 'BLOCKED: upload listing failed; boundary could not be verified.' >&2
  exit 2
fi
if [ ! -s "$list_file" ]; then
  echo 'BLOCKED: empty upload listing.' >&2
  exit 2
fi
pattern='(^|/)\.env[^/]*($|/)|\.(pem|p12|key)$|(^|/)[^/]*(service[-_]?account|credentials)[^/]*\.json$'
if LC_ALL=C grep -Ei "$pattern" "$list_file"; then
  echo 'BLOCKED: sensitive filenames in upload set; no submission permitted.' >&2
  exit 3
fi
printf 'UPLOAD BOUNDARY CLEAN: %s files\n' "$(wc -l <"$list_file")"
