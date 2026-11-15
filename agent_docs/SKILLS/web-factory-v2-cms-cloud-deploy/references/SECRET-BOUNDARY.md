# Credential handling, build secrecy and Upload Boundary

## Agent may discover, but not disclose

Operator explicitly allows locating values in `.env` or other local environment files. To protect data, agent discovers **filenames and variable names**, and operator-local helper reads secret **values** directly in the terminal after authorization. Never ask operator to paste a token or password in a chat. Do not run `cat .env.local`, `env`, `printenv`, `gcloud secrets versions access` or `set -x` to inspect values. No agent-generated report includes secret lengths, substrings or hashes.

`operator-upload-secrets.py` takes a mapping JSON of source key -> existing Secret Manager resource name. It handles conventional one-line dotenv strings, rejects malformed/duplicate/unsupported multiline expressions, streams bytes to the gcloud process **stdin** with stdout/stderr captured, and reports only key/secret names and statuses. It does not create secrets; that is a separate approved resource operation. A failed upload might create some new versions; record partial completion and retry deliberately. Do not claim it is transactional.

## Build-time versus runtime

Runtime-only: preferred. Build image without DB/R2/Payload secret values; supply at Cloud Run instance startup via Secret Manager. Verify production build without secrets in a clean harness (not with accidental shell env). Some Payload+Next versions/prerender flows may NEED Turso and/or Payload secret during `npm run build`; then a runtime-only profile cannot be claimed successful. Apply build-time decision tree: authorized BuildKit secret mounts and Build SA privilege with no Docker ARG or logged secret; or engineering restructures static build. Approved build-time content generation reads *live remote data*—record that production content can change between build and runtime. Beware side-effecting hooks; no migrations on build.

Cloud Build project may contain a default build SA; discover actual identity, grant exact secret version access ONLY for build-time secrets if needed, and evaluate trigger users' ability to exercise those rights. Never store secrets in source, Cloud Build substitutions, build arguments, Docker layers or output HTML. Audit logs and public bundles for secrets if build path used.

## Two contexts to protect

- `.gcloudignore`: what Cloud Build receives as uploaded source.
- `.dockerignore`: what `docker build` receives inside a Cloud Build worker.

Do not assume one protects the other. `scripts/check-upload.sh` uses the exact staged directory and `gcloud meta list-files-for-upload`. Fails closed on tool error/empty set/sensitive paths. It is not an exhaustive content scanner; review tracked source and committed secrets separately. Also verify Docker exclusion semantics independently (Docker available or manual review).

Examples of prohibited upload: `.env`, `.envrc`, `.env.local`, nested `.env.production`, private `.pem/.key/.p12`, credentials JSON, `.npmrc` with auth, `.aws`, `.ssh`, IDE secret exports and `.git` metadata. Local JS/TS files can still accidentally contain hardcoded values; that requires source review, not filename check alone.

Protected build references: `templates/Dockerfile.buildkit-example` + `templates/cloudbuild.buildkit-example.yaml`; read official Docker Build secrets and Google Cloud Build `availableSecrets` docs. The template intentionally contains replacement resource names and is NOT an authorized cloud command.
