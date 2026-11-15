**v1.2 EXTRA GATE:** Test a real in-repository `./deploy.sh` controlled redeployment and verify anonymous HTTPS. If not run, record FIELD REDEPLOY NOT VERIFIED, not success. Confirm `git ls-files` contains all four deliverables and support files.

# Phase 4 — Anonymous public verification, rollout and recovery

Read `references/PUBLIC-DEPLOYMENT-CONTRACT.md` first. It defines the only conditions under which a deployment may be called complete.

## Operational evidence after Cloud Run

- Read service readiness, actual revision/image/traffic, region/project, memory, `maxInstances`, runtime SA and the public-invocation readback; compare to authorization.
- Run the generated `verify-public.sh`. It calls `scripts/verify-runtime.py` against the Cloud Run service URL **and** the custom domain. Every request is anonymous: the helper sends no credentials and has no option to. Verification through an operator identity, an authenticated tunnel or a logged-in browser session is not verification and must not be substituted.
- It checks, on each URL: DNS resolution and HTTPS certificate validity; homepage HTTP 200; the configured public routes and a representative article; images and static assets referenced by those pages; ISR response headers when a revalidate interval is configured; the admin login page reachable and not publicly cached; protected API reads and an anonymous write probe denied **by the application**.
- Read the result strictly:
  - **exit 0, PUBLIC ACCESS VERIFIED** — both URLs pass.
  - **exit 3, DEPLOYMENT INCOMPLETE** — the service URL passes, the custom domain is not serving valid HTTPS yet. Check the mapping and DNS, wait for the certificate, rerun. Do not report success.
  - **exit 1, FAILED** — anything else. A 401/403 produced by Cloud Run IAM on a public page means the service is not public: a deployment failure, not a test problem.
- Application-level 401/403 on unauthorized CMS writes and protected reads is the expected, passing result. The helper tells the two apart; a denial it cannot classify counts as a failure.
- Verify Turso target indirectly through app's nonsecret config and real read evidence; R2 public image bytes and URLs. Secret Manager versions/bindings verified by metadata only.
- Verify ISR using preexisting app instrumentation and recorded time intervals; HTTP 200 and cache headers alone do NOT prove zero Turso reads or publish invalidation. A 30-second revalidate threshold is demand-driven and instance-local unless a shared handler is configured. Remote DB is not a substitute for a shared Next cache. `max-instances=1` is a pragmatic *POC setting* only and not a guarantee across restarts/replacements.
- Verify admin routes, APIs and Payload previews are not publicly cached; draft content never leaks. Use disposable test content only when approved by QA and operator. Do not weaken Payload authentication or authorization to make a check pass.
- If Docker wasn't available on local VM, confirm successful Cloud Build and actual Cloud Run startup; label local Docker as NOT RUN.
- Re-run the dependency audit and restate the security release gate record. The gate is decided before exposure (Phase 3); it is not reopened here by quietly changing who can reach the service.

## When public access cannot be verified

Status is FAILED or BLOCKED. Never declare the deployment complete, mark public verification PASS, hide the issue or switch to an authenticated test. Preserve the service and its revision, and give the operator the recovery procedure: the exact failing check, the readback of the invoker policy or invoker IAM check, any organization-policy refusal, the domain-mapping conditions and required DNS records, and the single next action.

## Recovery

Before a redeploy, capture current revision and full traffic splits. For failure after deploy, inspect logs, image digest, config/secret-name metadata, host targets and startup; never dump secret payloads. If preapproved contingency covers it, operator restores traffic to exact previous revision using current gcloud traffic command verified against installed version; otherwise stop for incident approval. A first deployment has no earlier revision to return to: an emergency withdrawal is an operator-approved incident action, recorded as an outage, never as a deployment state and never as success. Do not delete the service in the name of cleanup without distinct permission.

## Handoff

Write `DEPLOYMENT_CHECKLIST.md` outside submission tree or to a safe ops folder. Include QA source and release authorization, security gate record, identity actors, package manifest, public-access mechanism and readback, both URLs with the verifier's output and final status line, ISR findings, known security issues, old revision, recovery commands and Gate D ownership. Don't claim QA PASS or production readiness on DevOps's own authority.
