# Deployment workflow v1.1

## 1. Read-only intake
Run from the supplied repo: git status --short --branch, git rev-parse HEAD, git diff --stat and git ls-remote origin refs/heads/main. No pull/switch/commit by default. Record untracked skill files separately. Inspect package/lockfile, framework engines, scripts, Next config, local assets, env access, runtime network dependencies, middleware/server actions. Do not open .env or credential files. File absence alone does not prove secret-free behavior; inspect source dependencies too. If a required backend/secret exists, this mode does not apply; return the exact gap.

Check command -v gcloud, command -v docker, node --version and package manager version in YOUR subprocess environment. Inspect expected executable locations if PATH differs; do not claim globally absent from a PATH miss. Identify OS user and CLOUDSDK_CONFIG location metadata without reading credential contents.

End the first turn with a compact visible report. Ask for project ID and expected account email if missing. Propose region/service/access/limits together, not eleven disconnected decisions. Configured defaults are observed values, not approved intent.

## 2. Tooling and packaging prerequisites
CLI missing: propose the official installation method for the observed OS/architecture (https://docs.cloud.google.com/sdk/docs/install-sdk). If Tony authorized installation, perform it, verify executable/version in the same agent environment, and record its location. No copied credentials or unreviewed third-party installer. If sudo/browser interaction is required, provide the exact human step and END THE TURN. Do not install Docker solely for Cloud Build.

CLI login: Tony runs gcloud auth login in the same user/config environment. If CLI is outside PATH, give its verified absolute path. Verify active account matches intent afterward. Browser Console login alone is insufficient. Do not prescribe ADC without an application/library need. Do not print tokens.

Standalone absent: describe the smallest config addition, ask once for packaging-only permission if not already granted. With permission, preserve existing config and add only output: 'standalone', build, verify server.js and required public/.next/static assets in a separate runnable tree. Record exact change and build results; supply selective Git commands. Source release identity must include the accepted committed packaging change or an explicitly approved, hashed packaging overlay. No silent identity substitution.

Do not change application behavior or source to force a build through. Unknown dependency failure returns a concise blocked report, not an outside rescue request by default.

## 3. Destination verification and staging
Fill config from evidence. Use explicit --project and --region for cloud calls, not global config changes. Inspect project/billing status where permitted, enabled run/cloudbuild/artifactregistry APIs, registry, actual build service account (gcloud builds get-default-service-account --project PROJECT --region REGION, or verified explicit identity), runtime SA and relevant IAM. Check current official flags/help for installed version. Do not infer SA email from project number. Permission/network errors are UNKNOWN, not absence. Read success does not prove write permission.

Prefer a dedicated minimally privileged runtime SA; no secret/database roles in this mode. Existing SA reuse requires inspected policy. Report APIs/resources/IAM needed as explicit proposed changes. Do not silently grant broad roles. Inspect any existing service env/secret binding names only, ingress, invoker configuration, traffic and prior revision. Do not replace a service carrying unrelated configuration. Verify first deployment rather than assume it.

Create a NEW dated staging directory outside checkout; existing directories are inventoried/reused only intentionally. No deletion or rsync --delete. Assemble selected committed source with required build files/assets; exclude .env*, keys, credentials, agent_docs, QA/design archives, reports, node_modules and .next. Avoid blindly copying the working directory or entire Git archive including sensitive tracked files. Record all packaging additions and hashes. Keep reports outside upload tree. Preserve local font/artwork licenses.

Use templates as starting points, not universal files: npm template assumes package-lock.json and build script, single-app standalone server.js, public directory, compatible Node image. Verify assumptions; adapt to actual package manager, monorepo/path and native dependencies. Do not silently rewrite lockfiles or add secret build args.

## 4. Validate and present
Generate every file in package-contract.md, populated config, run record and release plan. Parse shell/YAML with available tools; validate config without eval. Resolve required placeholders; blank required config blocks execution. Verify Docker/build tool dependency versions. Run upload guard from the dedicated upload directory; retain effective listing. Mock guard clean/forbidden/error cases. Local Docker available: build/start and verify PORT/assets as packaging smoke. Otherwise record NOT RUN; do available standalone checks and require actual cloud build/startup success.

Present short plan with target/exposure, source/package identity, acceptance source, proposed resources and exact IAM changes, build/runtime actors, resource limits, recovery and validation gaps. 512Mi/min0/max1 are proposals, not a capacity/cost guarantee. Retain a complete written plan outside upload. Await Tony's authorization for that plan. Explicit POC acceptance exception is not independent Gate Q. Missing acceptance is reported, never researched/repaired by DevOps.

## 5. Execute approved plan
Reverify exact source/package hash, account and target. Query before creating each authorized resource. Stop on unexpected state. Only execute the approved bootstrap/IAM operations. Verify installed CLI syntax with official docs/help; record commands actually used.

Run scripts/check-upload.sh from EXACT upload tree immediately before every Cloud Build submission. Failed/empty/forbidden listing blocks submission. Submit generated cloudbuild.yaml with product-SHA substitution and verified image repository; capture build ID (async submission is preferable when UI progress is hidden). Monitor boundedly, return ID/status between turns if long. Do not submit another build because a chat delivery timed out.

On successful build, use its structured result to resolve the pushed image digest. Verify registry/repository and sha256 digest, then deploy IMAGE@sha256:DIGEST (never latest). Use explicit project/region, service, runtime SA, container port, memory, instance limits and public/private setting. Review exact available flags. Audit existing env/secret/traffic inheritance; explicitly resolve only approved differences. Build pushes image; local deploy actor deploys it. Build SA need not receive run.admin just because it builds; grant only demonstrated required permissions to the actual actor.

Read back revision, image digest, service URL, runtime identity, traffic, ingress and public/private access. Verify intended HTTP access. Public must work unauthenticated; private must reject unauthorized callers and pass authorized operational checks without retained tokens. Do not weaken organization policy to force public access. If identity/access differs, report mismatch; no silent repair outside plan.

## 6. Operational handoff to QA
Confirm revision ready, startup/access and representative static assets; inspect safe runtime logs. These are operational checks, not application QA certification. Deliver source SHA → packaging/upload hashes → build ID → image digest → revision → URL/traffic/access. Include rollback instructions and previous traffic, or honest first-deployment recovery limitation. QA independently tests routes/layout/content/metadata and issues Gate D. Do not run calls, form submissions or DNS changes.

## Official mechanics references
Verify against installed versions when generating commands:
- https://docs.cloud.google.com/run/docs/deploying
- https://docs.cloud.google.com/run/docs/container-contract
- https://docs.cloud.google.com/sdk/docs/install-sdk
- https://docs.cloud.google.com/build/docs/building/build-containers
- https://docs.cloud.google.com/sdk/gcloud/reference/topic/gcloudignore
- https://nextjs.org/docs/app/api-reference/config/next-config-js/output
