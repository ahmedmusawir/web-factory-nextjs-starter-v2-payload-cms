**v1.2 PERMANENT SOURCE ARTIFACTS:** Before starting Cloud Build, verify Dockerfile, cloudbuild.yaml, init-app.sh and deploy.sh (plus ops/ + config) physically exist and are Git-tracked in the website repository. Single-command redeploy `./deploy.sh` is mandatory; see `references/PERMANENT-REDEPLOY-CONTRACT.md`. External generated scripts may be used temporarily but never as the only deliverables.

# Phase 3 — Cloud Build → immutable image → Cloud Run

This skill ships reusable templates and a config-based operator script renderer, **not a universal blind deploy script**. Derive exact commands from populated approved config and installed `gcloud --help`. Commands must name PROJECT, REGION, service, identities, repo and access explicitly; show command for human operator to execute.

## Before Cloud Build

1. Validate the app and release config. Re-check committed source SHA or reviewed dirty snapshot manifest; detect any package drift and stop for reapproval.
2. Confirm the dedicated Cloud Build service account, required enabled APIs, Artifact Registry repo permission and logging bucket requirements. Check all pending cloud resource changes approved.
3. Run `scripts/check-upload.sh "<exact staging dir>"` immediately before **every** submission. Failed listing, zero files or protected path -> BLOCK. Do not try a blind second submit.
4. Use Cloud Build with unique product-SHA + Cloud Build ID image tag (not `latest`). Keep `cloudbuild.yaml` to build+push. For BUILD-TIME Turso access, use the separately approved protected BuildKit path only; default template is intentionally runtime-only and will fail if build requires credentials.
5. Record submission build ID and structured successful result. A timeout/browser disconnect is not evidence a build failed or stopped. Read existing build status before a retry.

## Release immutable image

1. Resolve SHA-256 from the successful build record / Artifact Registry and inspect it. Verify digest prefix and repository match approved image; never deploy tag in lieu of digest.
2. Before deploy, read back any existing target service. Record current revision, traffic %, image, environment variable names/secret bindings (not payloads), Actor C, ingress and public-invocation state. Unexpected ownership or drift = STOP.
3. Operator deploys digest to the **approved NEW service** by default. Explicitly set container port (Cloud Run injects PORT), `HOSTNAME=0.0.0.0`, memory, min/max instances, Actor C, approved nonsecret runtime environment variables, pinned secret versions and **public invocation**. Don't accidentally set an env value by copying the entire local env file.
4. Public invocation is mandatory and explicit. Use the mechanism recorded in the config: `--allow-unauthenticated` (grants `roles/run.invoker` to `allUsers`) or `--no-invoker-iam-check` (disables the invoker IAM check) where the project's policy requires that route. Before deploying, the security release gate must be cleared or carry the Director's recorded decision; if it is blocked, STOP and report BLOCKED. After deploying, read the setting back (`gcloud run services get-iam-policy …` for `allUsers`, or the `run.googleapis.com/invoker-iam-disabled` annotation). If an organization policy or a missing permission refused it, status is BLOCKED: keep the service, report the exact refusal, do not weaken the policy without Director authorization, and do not continue as though the site were deployed. Cloud Run invocation is separate from Payload login: the first admits visitors, the second protects administration.
5. Check `gcloud run services describe ...` for Ready=True, real revision and traffic/readback, image digest and URL. Ready is not success; success is Phase 4. Failed readiness -> safe logs/recovery; don't make another deploy by guessing.
6. Operator maps the custom domain (`map-domain.sh`: `gcloud beta run domain-mappings create --service … --domain …`), then compares the mapping's required records with the live DNS record. An existing CNAME is not proof the domain works: without a mapping and an issued certificate HTTPS fails. Where domain mappings are unavailable for the region, report BLOCKED with the alternative (a load balancer) for a separate decision.

## Record chain

`REPO/HEAD or reviewed SNAPSHOT → PACKAGE SHA → BUILD ID / BUILD SA → image@sha256:... → RUN REVISION / runtime SA → URL/traffic/ingress → PUBLIC INVOCATION READBACK → DOMAIN MAPPING → ANONYMOUS HTTP/ISR evidence (service URL + custom domain)`

The record resides **outside Cloud Build staging**. Only Actor A performs deploy, not build robot. Replacing an existing service is outside the mission unless explicitly and separately approved. The chain is not finished at the revision: it ends with anonymous HTTP evidence for both URLs (Phase 4).
