# Phase 1 — Package and build the real app

## Contract and staging

Create a *new* dedicated staging tree OUTSIDE the repo and the skill folder. Prefer a reviewed committed checkout. For dirty weekend POC changes, first show a changed/untracked filename inventory and request explicit snapshot authorization; only then use `scripts/prepare-release.py --include-reviewed-working-tree`. The utility copies permitted source files, refuses secret paths and symlinks, and writes a hash manifest outside staging. It is NOT a replacement for independent QA release identity.

Before generating, read `references/CONFIG-CONTRACT.md`, `decision-trees/build-time-database.md` and actual Next config. Adapt templates; do not forcibly replace the repo's working Dockerfile or deployment scripts. The generated release tree must have a valid lockfile, actual app source, supported Dockerfile and cloudbuild.yaml.

1. Read `package.json` Node `engines` and `.nvmrc`, npm/pnpm/yarn lock. Pick a compatible Node major and Debian/Alpine base based on actual native dependencies, not by habit.
2. Confirm `output: 'standalone'` and actual `distDir` (e.g. `.next` OR custom). A template copying `.next/standalone` is wrong if output is `.next-mission003`; fix both static/standalone path and startup path based on evidence.
3. Inspect route generation. If ISR/prerender accesses Turso during `npm run build`, decide the correct protected build-secret route BEFORE Cloud Build. Never use `ARG DATABASE_AUTH_TOKEN` or `--build-arg` for auth/R2 secrets. Cloud Build sees source upload; no `.env` or local DB token in upload. `BuildKit --secret` protected route needs separate explicit engineering/security approval and correct tested Dockerfile/Cloud Build implementation. If no secure path available, STOP.
4. Confirm Payload runtime writes to R2, not ephemeral container, and next ISR cache path is writable for nonroot process. Ephemeral ISR cache isn't cross-instance shared. Do not confuse source build artifacts with persistent remote editorial data.
5. Add/merge `.dockerignore` and `.gcloudignore` with any stronger current rules. Verify essential assets/fonts/licenses are retained; avoid excluding `public`, package lock or design system. Check `gcloud meta list-files-for-upload EXACT_RELEASE_TREE` with `scripts/check-upload.sh`. Docker ignore alone is insufficient.
6. Run app package tests and security checks where possible. On Docker unavailable, cloud build may perform the build; local Docker is NOT TESTED. Never use developer test PASS as a Cloud Run deployment PASS.
7. Produce `DEPLOYMENT_CHECKLIST.md`, release authorizations, source tree manifest, contemplated cloudbuild and Dockerfiles. Present summary to operator.

## Strict cloudbuild behavior

The generated Cloud Build job only **builds and pushes** a uniquely tagged image. It must not perform Cloud Run deployment automatically under Actor B. After build success the operator resolves immutable digest and deploys under Actor A. No `:latest` promotion. Record Cloud Build ID and actual actor B identity; no guessed project-number account.

Once code, config and Docker/Cloud Build are reviewed, render practical operator scripts via `scripts/render-operator-scripts.py`. It writes `init-app.sh` (read-only inventory), `build.sh` (guard + confirmed Cloud Build submission) and `deploy.sh` (confirmed digest-only deployment) to a NEW ops directory outside staging. Do not place scripts inside Cloud Build upload.
