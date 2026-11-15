# Skill v1.1 — offline helper verification

**Date:** 2026-11-15

**Result:** PASS for 21 offline regression test cases. **NOT TESTED** against real Docker/Cloud Build/Cloud Run or the operator's Payload repo. No cloud command was executed and no cloud resource was read or changed by these tests.

`tests/selftest.py` uses disposable temporary Git repositories, a stand-in `gcloud` binary that only records calls, and local loopback HTTP servers that imitate a public site, a Cloud Run IAM denial and a site with unprotected CMS endpoints.

Carried over from v1.0 (updated where config changed):

1. Config validation accepts a well-formed public config and rejects a secret misplaced in ordinary runtime env.
2. Repo intake identifies environment variable names without printing their values.
3. A safe, outside-repo, hashed release snapshot; dirty-source acknowledgement; block on tracked sensitive files.
4. Effective-upload list gate accepts safe filenames and rejects nested `.env`, credential JSON, `.npmrc`, SQLite files and empty listing.
5. The secret helper's dry-run performs no writes; an explicitly executed mock upload streams bytes to `gcloud` stdin without revealing them.
6. Operator scripts render with valid Bash syntax; unsafe build-time-secret and custom `distDir` mismatches block.

New in v1.1, mapped to the Director's required proofs:

| Required proof | Tests |
|---|---|
| Generated deployment commands configure public invocation | `test_generated_deploy_configures_and_reads_back_public_invocation` (both mechanisms, flag on the deploy command, readback present); `test_deploy_reports_incomplete_until_custom_domain_serves_https` (the recorded deploy call carries the public flag) |
| Anonymous public access is required | `test_verify_passes_public_site_and_sends_no_credentials` (no credential header reaches the server even with tokens in the environment); `test_verifier_has_no_authenticated_mode` |
| Cloud Run IAM 403 is a deployment failure | `test_cloud_run_iam_denial_is_a_deployment_failure`; classifier cases in `test_admin_and_api_authentication_must_remain_enforced` |
| Custom-domain HTTPS is checked | `test_custom_domain_https_is_checked_and_required` (decision cannot be skipped, plain HTTP refused, unresolved domain → INCOMPLETE, exit 3); `test_custom_domain_and_security_gate_are_required` |
| Private deployment cannot silently become the default | `test_private_deployment_cannot_be_configured_or_defaulted`; private config cannot be rendered; `test_blocked_security_gate_stops_public_deploy_without_private_fallback`; `test_deploy_fails_closed_when_public_invocation_is_refused` (exit 4, BLOCKED) |
| Admin/API authentication remains enforced | `test_admin_and_api_authentication_must_remain_enforced` (open write or open protected read fails verification) |

Whole-skill audits: `test_no_obsolete_private_first_instructions_remain` (every file, obsolete phrases allowed only inside a prohibition), `test_entry_points_identical_and_state_public_doctrine`, `test_reusable_logic_is_location_independent`, `test_package_checksums_match`.

**None of this establishes that a real site will build, run or be reachable in Google Cloud.** Real app build, IAM, organization policy, domain mapping, certificate issuance, ISR, authenticated Payload workflows and the security release gate remain live gates.

Run again after extraction:

```bash
python3 ./web-factory-v2-cms-cloud-deploy/tests/selftest.py
```
