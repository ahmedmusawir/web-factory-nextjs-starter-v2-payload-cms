# v1.2 DIRECTOR OVERRIDE — PERMANENT FOUR-FILE REDEPLOY CONTRACT

**MANDATORY BEFORE DECLARING A WEBSITE DEPLOYMENT COMPLETE:** install and verify the four versioned files **inside the website repository root**: `Dockerfile`, `cloudbuild.yaml`, `init-app.sh`, `deploy.sh`. Also retain `.dockerignore`, `.gcloudignore`, `stark-deploy.json` (never secret payloads) and `ops/` repo-local helper scripts. After initial infrastructure provisioning, the owner must be able to run **`./deploy.sh` alone from the website checkout** to build current source, resolve image digest, redeploy publicly and anonymously verify both URLs. No skill-folder path dependency or temporary-only scripts. See `references/PERMANENT-REDEPLOY-CONTRACT.md`, `scripts/install-repository-toolchain.py`, and **read all four exact historical examples** in `examples/field-proven-four-files/` before preparing CMS versions. The second proven complex-app four-file set is in `examples/app-skill-v1.3-proven/`. These examples are history, never blindly executed.

**Existing v1.1 guidance that renders operator scripts only outside the repository is superseded for lasting artifacts.** Temporary secure staging for Cloud Build remains required, but the canonical deployment files MUST be committed inside the website repo. Treat missing four files or a one-shot external deployment as **DEPLOYMENT PROCESS FAIL**, even if the website is already live.

---
name: web-factory-v2-cms-cloud-deploy
description: >
  Operator-guided, portable Cloud Run deployment skill that puts Next.js plus Payload CMS websites on the public internet using remote Turso/libSQL and Cloudflare R2. Activate when asked to prepare or deploy a Web Factory V2 CMS site, reuse existing remote content, manage runtime secrets, map the custom domain, verify anonymous public access, prove 30-second ISR, troubleshoot or recover a revision. Websites are public by default; admin and CMS writes stay application-protected. Both Claude Code and Codex can read this folder; the human authorizes and executes cloud writes.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# STARK WEB FACTORY V2 — CMS CLOUD DEPLOY (v1.1)

## Role
You operate as the **Stark Skill DevOps guide** in Claude Code or Codex. Read `CLAUDE.md`/`AGENTS.md` first (identical), then these phases. Human operator executes approved cloud-changing commands. You create the deployment package and interpret readback. **Doctrine: Web Factory deployment = public website.** A website visitors cannot reach is not deployed. Scope: **Cloud Run** public service and its custom-domain mapping; not DNS-provider record edits, Vercel automation, code features, database replication or QA certification.

## Phase 0 — Read-only discovery → Plan Mode STOP
**Goal:** identify the real repository and current cloud, without presuming locations or secrets.

1. Follow `workflow/00-discover-and-plan.md`. Resolve skill paths relative to this folder and repository paths from CWD or operator answer.
2. Run `scripts/inspect-repo.py --repo REPO` to report safe structure/status and key NAMES; inspect `package.json`, Next config, Payload source, env contracts, prior Docker, QA evidence. Respect current uncommitted work.
3. Check actual active `gcloud` account/project and tool availability; capture no token output. Discover prior Cloud Run service and build/runtime identities using READ-ONLY gcloud queries if permissions allow.
4. Determine source acceptance: QA PASS, QA BLOCKED, or explicit POC exception. Record the security release gate status (cleared / Director exception / blocked). Collect missing PROJECT/REGION/SERVICE/CUSTOM-DOMAIN/PUBLIC-ACCESS-MECHANISM facts in one concise reply; whether the site will be public is not a question.
5. Read back whether the project can grant public invocation (organization policy, existing public services) and whether the custom domain's DNS and mapping exist. Present exact public target, resources reused, planned changes, identity actors, known unknowns and risks. **STOP: await operator approval** of local packaging and proposed target before modifying files.

**Gate 0:** evidence + PLAN approved; unknown repo/target or absent approval = STOP. Output: intake notes, operator plan, missing inputs.

## Phase 1 — Package application → Local verification STOP
**Goal:** build an identifiable, secret-free Cloud Build submission tree outside the checkout.

1. Follow `workflow/01-package-and-build.md`; read `references/CONFIG-CONTRACT.md` and `decision-trees/build-time-database.md`.
2. Use `templates/deployment-config.example.json` as a guide; create a populated **nonsecret** configuration file outside release upload. Run `scripts/validate-config.py --config FILE` before cloud execution.
3. Preserve code; copy vetted source with `scripts/prepare-release.py` into a new, empty directory outside repo. On dirty branches, require explicit `--include-reviewed-working-tree` acknowledgment; keep a SHA-256 per-file manifest outside upload tree. Do not overwrite source repo scripts.
4. Adapt `templates/Dockerfile`, `.dockerignore`, `.gcloudignore` and `cloudbuild.yaml` from observed app. Confirm package manager, actual Next `distDir`, standalone output, build-time remote DB needs, native libraries, runtime non-root permissions, assets, PORT and file boundaries. Do not silently use examples as an executable deployment.
5. After the agent adapts source Docker/Cloud Build files, use `scripts/render-operator-scripts.py --config FILE --stage STAGE --out NEW_OPS_DIR` to generate operator-side `init-app.sh`, `build.sh` and `deploy.sh` outside the upload tree. The human still approves and runs them. Validate generated scripts (`bash -n`), YAML/build structure and lockfile. If possible test production standalone or Docker; if Docker unavailable label NOT RUN. Check build security audit. Run `scripts/check-upload.sh EXACT_RELEASE_DIRECTORY` immediately prior to each Cloud Build submit (not just once at generation).
6. Present the source/package identity and build access findings. **STOP if leaked credentials, unsupported buildtime secret path, unverified upload or missing acceptance.**

**Gate 1:** package/source hashes recorded, verified exclusions, application build requirements known, blockers explicit. Output: release staging directory, checksums, Docker/Cloud Build files, checklist.

## Phase 2 — Secret Manager / IAM → Operator boundary STOP
**Goal:** approved environment binds to the same Turso/R2 backend, without exposing secrets.

1. Follow `workflow/02-secrets-and-iam.md` and `references/SECRET-BOUNDARY.md`.
2. Fill `templates/secret-mapping.example.json` **with names only** (SOURCE_ENV and GCP_SECRET_NAME). Do not copy secret values. Agent may inspect `.env` variable NAMES/presence only.
3. Verify actual project, enabled APIs, Artifact Registry, Actor B build identity, Actor C runtime SA, per-secret IAM and current service state. Request operator approval before new GCP resources, IAM or secret versions.
4. Operator runs `scripts/operator-upload-secrets.py --project ... --env-file ... --mapping ... --execute` locally. It reads `.env` privately and streams values to `gcloud` stdin; it never prints them. Verify secret version IDs and bindings without accessing payloads. Never grant broad project-level Secret Accessor to default compute identity as convenience.
5. Verify `DATABASE_KIND=turso`, `MEDIA_STORAGE=r2`, target-host guards and correct approved bucket. Different app URL values may be required for local/preview/production, even with shared DB/R2. Never blindly reuse local URLs or `APP_ENV=test` in staging.

**Gate 2:** all names/versions/IAM approved and verified, secrets not surfaced, target remote backend verified. Output: Actor A/B/C, secret mapping, operator receipts, safe runtime env specification.

## Phase 3 — Build and deploy immutable digest → Operator boundary STOP
**Goal:** deploy a new Cloud Run revision without damaging the existing site.

1. Follow `workflow/03-build-and-deploy.md`; reconfirm active account, project, source and staging hashes, authorization and the exact service name (a new service by default, so nothing existing is overwritten) and the security release gate. If the gate is BLOCKED, stop here and report; build may proceed, exposure may not.
2. Immediately before submission run `scripts/check-upload.sh STAGE_DIR`. If Docker is unavailable locally, Cloud Build may build remotely; record local Docker as NOT RUN.
3. Operator submits cloudbuild.yaml using approved build identity and unique tag/build ID. `cloudbuild.yaml` **only builds and pushes**; never autonomously deploy from inside a build robot. Record build ID/status, verify successful build and resolve immutable `@sha256:` digest from official structured result.
4. Read back existing service identity, traffic, ingress, secrets and revision before any deployment. If actual state differs from approved plan, STOP; do not overwrite unrelated service.
5. Operator deploys **image by immutable digest** with explicit Actor C, pinned secret versions, nonsecret runtime env, resource limits and **explicit public invocation** (`--allow-unauthenticated`, or `--no-invoker-iam-check` where the project uses that mechanism). The generated `deploy.sh` refuses to run while the security gate is blocked and has no other access mode.
6. Read back revision, image, identity, URL, traffic, ingress and **public invocation**; a deploy command's exit 0 proves neither public access nor HTTP/ISR functionality. If the readback shows the service is not public (for example an organization policy refused it), status is BLOCKED: report it, keep the service, do not carry on as if deployed.
7. Operator maps the custom domain with the generated `map-domain.sh` and confirms the DNS record matches the mapping's required records.

**Gate 3:** verified digest/revision/URL, public invocation confirmed by readback, domain mapping created, no secret leakage, prior revision/traffic recorded. Output: identity chain and exact Cloud Run readback.

## Phase 4 — Anonymous public verification, recovery and handoff
**Goal:** prove that ordinary visitors reach the website on both URLs, that the MOVED application still uses remote Turso/R2, and that admin/cache boundaries hold.

1. Follow `workflow/04-live-verify-and-recover.md`, `references/PAYLOAD-ISR-CONTRACT.md` and `references/SECURITY-GATES.md`.
2. Run the generated `verify-public.sh` (it calls `scripts/verify-runtime.py --service-url … --custom-domain-url …`). Every request is anonymous; the helper cannot send credentials. It checks homepage 200, public routes, a representative article, images and static assets, HTTPS certificate validity, the admin login page (reachable, uncached), application-level denial of protected reads and of an anonymous write probe, on **both** the Cloud Run URL and the custom domain. Exit 0 = PUBLIC ACCESS VERIFIED; 1 = FAILED (a Cloud Run IAM 401/403 is a deployment failure); 3 = DEPLOYMENT INCOMPLETE (custom domain not serving valid HTTPS yet). Do NOT run mutating CMS actions against live content without a separate, disposable test plan.
3. Verify ISR 30s in the deployed runtime with app-specific cache instrumentation and publish/revalidate evidence. The helper's HTTP smoke alone is **NOT** proof of ISR. Check Cloud Run `max-instances`, cache write permissions and cache consistency caveats.
4. Confirm Turso DB target and R2 bucket via non-secret config/readback and app-level evidence; never print DB token or secret bytes. Ensure no startup seed/migration/reset happened and admin user persists.
5. Complete `DEPLOYMENT_CHECKLIST.md` against `references/PUBLIC-DEPLOYMENT-CONTRACT.md` items A–L: release chain, QA provenance, security gate record, build result, public-access readback, anonymous results for both URLs, pages + blog, rollback instructions, gaps and QA Gate D assignment.
6. Report exactly one status: PUBLIC ACCESS VERIFIED, DEPLOYMENT INCOMPLETE (custom domain provisioning), FAILED or BLOCKED. Never report complete on the `run.app` URL alone when a custom domain is configured. Vercel/production promotion require a separate explicit authorization. QA—not DevOps—issues Gate D.

**Gate 4:** contract items A–L evidenced anonymously, or a clearly stated INCOMPLETE/FAILED/BLOCKED with the service preserved and a recovery procedure; rollback path documented, human handoff complete.

## Example

Operator: “Read `/USB/skills/web-factory-v2-cms-cloud-deploy` and deploy this Payload POC.”
Agent: “EVIDENCE: I located the repo at the current CWD, a dirty branch and an existing Turso/R2 configuration by variable names. GAP: Claudy QA report unavailable. The target is a new public Cloud Run service on your custom domain; the security gate reads BLOCKED until there is a fix or your recorded decision. QUESTION: may I stage an explicitly reviewed working-tree snapshot? No cloud writes yet.”
Operator: “Approved for packaging; hold deployment.”
Agent: “Prepared a hashed staging tree, upload guard PASS; no cloud writes. Here's the package and the exact next approval needed.”

## Skill-specific anti-patterns

- Assuming Cloud Run host move implies data migration or a new Turso/R2 resource.
- Copying `.env.local` to Cloud Build because Docker will ignore it.
- Feeding Turso, R2 or Payload secrets into Docker ARG, Cloud Build substitutions or stdout.
- Replacing a live static service without recording identity/traffic and explicit authorization.
- Calling a local 30-second revalidate constant proof of Cloud Run ISR.
- Claiming production release approval while an unresolved critical CMS dependency remains.
- Reporting a deployment complete when visitors cannot reach it: build success, Ready revision, a `run.app` URL or a 200 obtained with operator credentials are not completion.
- Treating a Cloud Run IAM 401/403 on a public page as anything other than a deployment failure.
- Testing a public website through an authenticated path (operator identity, proxy tunnel) and calling it verified.
- Deploying without public invocation because a gate or policy is in the way, instead of reporting BLOCKED.
- Weakening Payload authentication, authorization or organization policy to make public checks pass.
- Binding `:latest` secrets when the release requires pinned reproducible versions.
- Secretly importing a fixed Cyberize path/project/account from examples.
- Declaring TESTED when Docker was unavailable, build failed or remote endpoints were not checked.

## Completion criteria

Produce a concise operator summary and a written run record containing: accepted source/snapshot identity; input source vs application release; exact project/region/service; three actors; secret mapping NAMES and versions only; upload guard evidence; Cloud Build ID/result; registry image `@sha256` digest; Cloud Run revision/URL/traffic/ingress; public-access mechanism and readback; domain mapping and certificate state; anonymous verification output for both URLs with the final status line; ISR limits; rollback commands; security and QA status; checks NOT RUN; next steps/owner. No Vercel deployment and no DNS-provider edits automatically. An honest BLOCKED, FAILED or INCOMPLETE status is a valid result; a premature “deployed” is not.

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-11-15 | Cloud Run-first Next/Payload/Turso/R2 deployment with portable activation, strict secret and source discipline, ISR, immutable digests and QA handoff. |
| 1.1 | 2026-11-15 | Public website by default: mandatory public invocation with readback, custom-domain mapping, anonymous verification, success contract A–L, fail-closed statuses; restricted-access-first stage removed; security gate before exposure kept. |
