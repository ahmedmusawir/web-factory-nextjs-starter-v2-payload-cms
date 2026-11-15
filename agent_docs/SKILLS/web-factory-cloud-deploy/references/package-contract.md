# Generated deployment package contract

Generate from the verified repository and filled config; these are requirements, not ready-to-run cloud files with guessed values.

| File | Requirements |
|---|---|
| Dockerfile | Compatible Node version in deps/build/runner; npm ci with dev dependencies for build; next build with standalone output; copy public, .next/static and .next/standalone; run as non-root; HOSTNAME=0.0.0.0; listen on Cloud Run PORT (default 8080); CMD node server.js. No application secret ARGs or env files. |
| .dockerignore | Exclude .git, node_modules, .next, .env* at every depth, credential extensions/names, QA/design/skill archives and reports. Keep local fonts, artwork, licenses and lockfile. |
| .gcloudignore | Explicit reviewed upload exclusions; same credential boundary as Docker plus local build output and nonruntime evidence. Verify effective listing rather than trusting patterns. |
| cloudbuild.yaml | Build and push only; explicit verified substitutions; image tag product SHA plus unique build ID, and image entry for digest output. No secretEnv, availableSecrets, --set-secrets, mandatory URL ARG or baked secret values. Log build actor. |
| init-app.sh | Verify existing project/APIs/registry/identities; create only explicitly planned app resources. Missing IAM is a reported gap, never a silent broad grant. No Secret Manager operations. |
| deploy.sh | Fail closed on missing config/required acceptance record (QA or explicit Director POC exception)/release evidence/source identity/account/upload listing. Invoke upload guard before submit; capture successful build result; validate digest format and repository; deploy by digest with explicit runtime SA, PORT/access/resource settings. Record traffic/revision/access. Stop on error. |
| DEPLOYMENT_CHECKLIST.md | Intake, QA/release evidence, packaging changes, actor A/B/C, source/upload identity, build/digest/revision, URL/access/traffic, prior revision/rollback, smoke checks, unresolved issues, Gate D handoff. |

Validate generated code before proposing execution. Copy the supplied guard beside deploy.sh; use its directory explicitly so it cannot run in an accidental working directory. Shell arguments must be arrays or safely quoted; never eval config. Verify any added tooling dependency instead of assuming yq/PyYAML exists on Tony's VM.

DevOps verifies operational startup/access and hands application testing to independent QA. A Director-approved POC acceptance exception must be recorded without inventing certification. No application metadata repairs are part of deployment packaging. A frozen-contract mismatch goes back to Architect/engineering and affected QA.

Official references consulted 2026-11-01:
- https://docs.cloud.google.com/run/docs/deploying
- https://docs.cloud.google.com/run/docs/container-contract
- https://docs.cloud.google.com/sdk/gcloud/reference/topic/gcloudignore

Freshness: verify current official flags/documentation when generating executable cloud commands. Local/static validation does not establish live IAM or successful deployment.
