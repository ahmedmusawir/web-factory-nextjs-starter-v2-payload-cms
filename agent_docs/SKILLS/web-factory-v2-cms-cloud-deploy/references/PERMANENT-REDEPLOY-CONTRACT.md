# Mandatory repository permanence and one-command redeploy contract — v1.2

**DIRECTOR HARD RULE:** Any Web Factory V2 website deployed to a public Cloud Run service MUST contain the following four **versioned** artifacts at the WEBSITE REPOSITORY ROOT:

- `Dockerfile` — actual reviewed Next.js + Payload server container; never substitute an old static or Supabase example
- `cloudbuild.yaml` — actual reviewed Cloud Build build/push-only configuration, with approved build-time secret mechanism where needed
- `init-app.sh` — idempotent initial resource *preflight* or bootstrap, not called on routine deployment
- `deploy.sh` — a **single executable** command to stage current local source, guard upload, perform Cloud Build, obtain immutable digest, deploy existing approved Cloud Run service publicly, verify `run.app` + approved custom domain anonymously, and report status

Both `.dockerignore` and `.gcloudignore`, `stark-deploy.json` (non-secret project settings, pinned Secret Manager versions and release gate), and `ops/redeploy.py`, `ops/check-upload.sh`, `ops/verify-runtime.py` are **also permanent** repo-tracked support files. No dependency on the skill folder, its original absolute path, temporary release directories, Codex/Claude, or another agent at redeploy time. A cloned repository plus authenticated gcloud CLI, installed Python 3 and access to GCP must suffice. Infrastructure and secret provisioning are one-time agent/operator tasks, not routine `deploy.sh` actions.

## Required user experience

First deployment: agent performs one-time infrastructure setup with Director approval, installs four files and all support files into repo, verifies, operator can run `./init-app.sh` then `./deploy.sh` when service exists. For a truly new Cloud Run service the initial provisioning remains an explicitly approved agent/operator workflow; `deploy.sh` **requires the named service to exist** and refuses to create a surprise new service. Once provisioned, routine deployments are exactly `./deploy.sh`.

Subsequent releases: user modifies the site, logs into Google Cloud, sets project correctly, runs `./deploy.sh` from repo. No separate Cloud Build command, manually found digest, first-time initialization, new service accounts, secrets or DNS. Existing site/revision can update; user confirms exact service. Current working tree changes must be included in the staged source snapshot after confirmation, not silently ignored. The toolchain is included in Git and can be recovered anywhere.

## Security and release gates

Public invocation is mandatory; no public IAM 403. Admin/API remain authenticated. Runtime/build credentials belong in Secret Manager, pinned by version, and are never printed or uploaded via `.env`. The build-stage Cloud Build config and Dockerfile must be reviewed against actual app needs. A security exception must have an approved reference, scope and `expires_on` (YYYY-MM-DD) expiry in the per-site JSON; do not reuse an expired exception or waive unrelated findings. Unknown-cache-404 containment, production image secret scan and ISR QA are prerequisites according to current project acceptance criteria. New infrastructure/IAM/secret version changes remain separate approvals.

`deploy.sh` does not edit DNS, create a domain mapping or provision secret values. It does verify an already configured domain and reports `INCOMPLETE` if TLS provisioning is unfinished. Admin user and Turso/R2 data stay intact; normal host relocation is not a database migration.

## How skill installs the artifacts

1. Inspect `examples/field-proven-four-files/` **all four**, and `examples/app-skill-v1.3-proven/` (second reference).
2. Inspect target repo's *actual deployed* Dockerfile and working Cloud Build YAML, the GCP project/region/service, dedicated IAM identities and pinned secrets.
3. Generate/review a complete `stark-deploy.json` matching `templates/deployment-config.example.json`. The sample contains placeholders and an invalid sample `APP_ENV=staging` for the initial POC; use an **app-supported** value (`preview` in the current POC, but do not hardcode globally).
4. Use `scripts/install-repository-toolchain.py --repo ... --config ... --dockerfile ... --cloudbuild ...` to install/verify the four artifacts plus local helpers. Existing files are never silently overwritten; use `--replace-reviewed` only after reviewing the diff.
5. Test `bash -n init-app.sh deploy.sh`, run local/static tests and `./init-app.sh`; run a controlled `./deploy.sh` from inside the repo when authorized. Verify final anonymous HTTPS and current revision/digest. Produce evidence; record exclusions and barriers honestly.
6. **Commit all non-secret files into website Git** after Director authorization. Verify `git ls-files` shows each mandatory file. A ZIP outside the repo is not a substitute.

### Important caveats on v1.2 reference runner

The new `scripts/redeploy.py` is an offline-validated reference implementation whose actual `gcloud` command/JSON assumptions must be validated in the target's installed gcloud version during first field execution. It does **not** claim an independently confirmed live redeploy until execution evidence exists. The project-specific `cloudbuild.yaml` must tag as `${_IMAGE}:${_PRODUCT_SHA}-$BUILD_ID` and build/push; the runner resolves and verifies its immutable digest before Cloud Run deployment.
