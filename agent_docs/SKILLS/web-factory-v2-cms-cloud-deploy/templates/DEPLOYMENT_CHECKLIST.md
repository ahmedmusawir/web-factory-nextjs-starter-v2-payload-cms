# STARK WEB FACTORY V2 — CLOUD RUN RELEASE CHECKLIST

**State:** DRAFT — Not a release approval, not a QA certificate.

## Identity and authorization
- Application / repo / branch:
- Commit HEAD + dirty worktree? 
- Reviewed working-tree snapshot hash inventory (if applicable):
- Independent QA report and verdict, matching revision?:
- Security disposition (esp critical CMS editor dependencies):
- Operator plan approval reference:
- Cloud write approval reference:

## Targets and actor identities
- Actor A active GCP account:
- Project / region:
- NEW service name (or approved existing-service exception):
- Existing services preserved / readback:
- Artifact Registry repo/image:
- Actor B dedicated Cloud Build SA:
- Actor C actual Cloud Run runtime SA:
- Public access mechanism (allUsers invoker / invoker IAM check disabled); organization policy readback:
- Custom domain; DNS record target observed; domain verified for operator:
- Exact Turso host/DB and R2 bucket (no secret values):
- Approved public origin URL/cookie/Payload-preview considerations:
- Runtime secret bindings names + pinned version IDs ONLY:
- Build-time DB needed? Verified how? Protected build path approved?:
- Schema compatible? Applied migration? (NO for ordinary host move):

## Package and upload
- Release staging path outside source:
- File SHA-256 manifest path (outside upload):
- Dockerfile/Next distDir/standalone verified:
- .dockerignore/.gcloudignore reviewed:
- Effective gcloud upload guard PASS + timestamp:
- Docker local: PASS/FAIL/NOT RUN:
- Static code/Dependency audit result:
- Public client bundle/secret-content review:

## Cloud operations (human-executed)
- IAM/Secret Manager approvals and evidence:
- Operator secret upload receipt (names/versions only):
- Cloud Build command / ID / status:
- Unique image tag and resolved IMAGE@sha256: digest:
- Existing revision, image, traffic, access BEFORE:
- Cloud Run deploy command, actual revision, image, runtime SA:
- Service URL, ingress, traffic AFTER:
- Public invocation readback (binding or annotation) AFTER:
- Domain mapping created; required records vs live DNS; certificate state:

## Public deployment contract (anonymous; both URLs) and QA handoff
- A public invocation configured (readback):
- B anonymous HTTPS to Cloud Run URL:
- C homepage 200:
- D public routes + representative article:
- E images and static assets:
- F no Google IAM login required (no Cloud Run IAM denial):
- G admin login reachable, uncached; protected reads denied by the application:
- H unauthorized CMS write denied by the application:
- I custom domain resolves:
- J custom domain serves the site over valid HTTPS:
- K blog + ISR interval (headers here; publish-driven proof at Gate D):
- L security release gates (QA verdict; gate record):
- verify-public.sh final status line and exit code:
- Remote Turso read and R2 image bytes evidence:
- 30s ISR deploy check; instance-local limits disclosed:
- Cookies/previews/publish tests (approved disposable content):
- Known blockers and NOT RUN checks:
- Rollback (previous revision/traffic) OR first-deployment withdrawal plan:
- Gate D independent QA owner and status:
- DNS records changed by operator? What and when:

## Final verdict
[ ] PUBLIC ACCESS VERIFIED on both URLs — READY FOR INDEPENDENT GATE D
[ ] DEPLOYMENT INCOMPLETE (custom domain not serving valid HTTPS yet)
[ ] FAILED (document the failing check and recovery)
[ ] BLOCKED (security gate or organization policy; document exact reason)
