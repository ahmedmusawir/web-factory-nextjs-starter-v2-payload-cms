# Phase 2 — Remote Turso/R2 bindings, Secret Manager and IAM

## Map configuration WITHOUT values

Inspect application code to discover required env names; example names only: `DATABASE_KIND`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `DATABASE_TARGET_HOST`, `MIGRATION_TARGET_HOST`, `MEDIA_STORAGE`, `R2_BUCKET`, `R2_TARGET_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `PAYLOAD_SECRET`, `APP_ENV`, `NEXT_PUBLIC_SERVER_URL`, `PAYLOAD_PUBLIC_SERVER_URL`, `NEXT_DIST_DIR`. Some are optional or named differently by specific app. Do not invent them in release config without evidence. Use app-specific validation guards; a remote *host string* must match exactly what is approved.

Inspect `.env` key names by a non-secret helper; operator tells location if multiple candidates. Never expose values via `cat`, `env`, `printenv`, shell `set -x`, debug logs or gcloud command-line args.

Map each secret KEY NAME to a GCP SECRET NAME in a separate JSON mapping. Runtime bindings use Cloud Run's `--set-secrets` (prefer pinned numeric versions). If a cloud secret exists but has no enabled version, report it. New version uploads must be explicitly approved. The operator runs `scripts/operator-upload-secrets.py` locally; the script takes secret values from private file and pushes bytes through `gcloud secrets versions add --data-file=-`. No secret value is copied to artifact reports. Do not upload secrets to Cloud Build for runtime-only needs.

## Three actors and IAM

Actor A: human `gcloud` caller, correct project/account and approved resource actions.
Actor B: a dedicated least-privilege Cloud Build service account passed explicitly with `--service-account`; needs Artifact Registry writer, log writer and, for a protected build only, accessor on the exact build-time secrets. Read the project default with `gcloud builds get-default-service-account ...` for the record, but do not run secret-reading builds as a broad default identity.
Actor C: dedicated Cloud Run runtime SA; needs access to EXACT named runtime secrets only. Do not give Actor B run.admin or Actor C blanket editor for convenience. Use per-secret IAM where possible.

For existing project, query APIs, repo, runtime SA, secrets, IAM and prior service. Missing permissions ≠ missing resource. If absent, present exact create/grant commands (from current official CLI help) separately for operator approval. Do not auto-create or reassign IAM. Confirm Cloud Run Secret Manager access via actual service account. Record `latest` for proposed version only if the operator consciously chooses rotation behavior; prefer numeric for deterministic release.

## Host-specific settings

Same DB and bucket can serve local, staging and Vercel; **origin URLs, login redirect allowed hosts, cookie configuration, `APP_ENV` and preview URLs may differ by environment**. They are runtime settings, not content migration. Do not accidentally point staging to a local loopback URL. A public R2 development URL (`r2.dev`) should be flagged for later hardened custom domain; do not promise CDN performance from it.

**Gate:** no plaintext secret in agent messages, package or artifacts; correct remote target; approval of cloud writes; IAM and source secret versions evidenced.
