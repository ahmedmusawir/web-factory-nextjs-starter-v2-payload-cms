# Public deployment verification contract

**Web Factory deployment = public website. A website visitors cannot reach is not successfully deployed.**

## What does not count as success

- Cloud Build succeeded.
- The container started.
- Cloud Run reports the revision Ready.
- The service has a generated `run.app` URL.
- The service returned 200 to a request that carried operator credentials or went through an authenticated tunnel.

## Success requires all of A–L

| | Requirement | Evidence |
|---|---|---|
| A | Cloud Run public invocation is configured | Readback of the `allUsers` invoker binding, or of the invoker-IAM-disabled annotation |
| B | An anonymous HTTPS request to the Cloud Run URL succeeds | `verify-runtime.py`, service URL block |
| C | The homepage returns HTTP 200 | same |
| D | Public website routes load | same, configured `--path` values and the representative article |
| E | Public images and assets load | same, images and `/_next/static` assets found on those pages |
| F | No Google IAM login is required | no Cloud Run IAM denial on any public request |
| G | Payload admin login is reachable and authentication is enforced | login page 200 and uncached; protected reads denied by the application |
| H | Unauthorized CMS writes are denied | anonymous write probe returns an application-level 401/403 |
| I | The intended custom domain resolves | DNS check, custom-domain block |
| J | The custom domain serves the website over valid HTTPS | certificate check and the same page checks on the custom domain |
| K | The public blog and the configured ISR interval work | blog route and article 200; ISR headers; publish-driven regeneration confirmed at Gate D |
| L | All required security release gates pass | QA verdict and the security gate record (cleared, or the Director's recorded decision) |

Items B–J are checked by `scripts/verify-runtime.py`, which the generated `verify-public.sh` and `deploy.sh` run. A, K (in full) and L need the readback, the app's own ISR evidence and the gate record.

## Rules for the checks

- Requests are anonymous. No credentials, no operator identity, no authenticated tunnel, no logged-in browser session. The helper has no way to add credentials.
- Both the Cloud Run service URL and the configured custom domain are checked.
- A 401/403 from Cloud Run IAM on a public page is a **DEPLOYMENT FAILURE**.
- A 401/403 from the application on an unauthorized CMS write or protected read is the **expected** result. A denial that cannot be classified is treated as a failure.

## Statuses — exactly one is reported

| Status | Meaning | Exit code |
|---|---|---|
| PUBLIC ACCESS VERIFIED | B–J pass on both URLs | 0 |
| DEPLOYMENT INCOMPLETE | Service URL passes; custom domain not resolving or not serving valid HTTPS yet | 3 |
| FAILED | Any other failed check, including a Cloud Run IAM denial | 1 |
| BLOCKED | Exposure cannot proceed: security gate not cleared, or organization policy refuses public access | deploy.sh exits 2 or 4 |

## Fail-closed reporting

When public access cannot be verified: never declare the deployment complete, never mark public verification PASS, never hide the issue, never substitute an authenticated test and never propose a service without public access as the way forward. Preserve the existing service and revision and state the recovery procedure: the failing check, the public-access readback, any policy refusal, the domain-mapping conditions and required DNS records, and the next single action.

## What stays protected

Public website access is not public administrative access. Payload admin stays behind application authentication, CMS write APIs behind application authorization, secrets in Secret Manager. Organization policy is not weakened without explicit Director authorization. The security release gate is decided before exposure and is never waived silently.
