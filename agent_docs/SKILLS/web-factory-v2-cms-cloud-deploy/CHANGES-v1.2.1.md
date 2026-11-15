# v1.2.1 — field corrections from the first live one-command redeploy (2026-11-15)

Applied to `scripts/redeploy.py` (installed in website repos as `ops/redeploy.py`) after installing the
v1.2 toolchain in the cyber-cms-poc-1 repository and running `./deploy.sh` against the live service.

- A tracked `.env.example` no longer blocks staging (it is skipped, never uploaded). Other secret-looking paths still block.
- Plain names listed in `.gcloudignore` are not staged, so large evidence/QA folders cannot block or bloat a release.
- The build is submitted asynchronously and polled, with a log link and status lines, instead of a silent multi-minute wait.
- The image digest comes from the Cloud Build result for the exact tag and is cross-checked against Artifact Registry.
- `gcloud run deploy` is followed by `update-traffic --to-latest`, so a release after a rollback is not left at 0% traffic.
- Distinct exit codes: 0 verified, 1 failed, 2 blocked before any cloud change, 3 incomplete (custom-domain HTTPS).
- A missing confirmation (EOF) is a clean refusal instead of a traceback. `--yes` and `--verify-only` added.
- `init` lists every required resource as OK/MISSING, including enabled APIs, the service and the domain mapping.
- The run ends with a summary: build ID, digest, revision, URLs and the rollback command.

Field evidence: build 5a221174-4537-4663-badd-4b34d2acf3a8, revision cyber-cms-poc-1-00002-nkx, anonymous
verification passed on the run.app URL and the custom domain. Not yet exercised live: `invoker-iam-disabled`,
a deployment without a custom domain, the exit-3 path, and a release following a rollback.
