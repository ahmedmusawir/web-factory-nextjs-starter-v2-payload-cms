# Changes in v1.1 — public website by default

**Director ruling, 2026-11-15:** public website deployment is mandatory. A website visitors cannot reach is not successfully deployed. The v1.0 doctrine that put a restricted-access stage first is revoked.

## Doctrine

- Every standard deployment targets a publicly invokable Cloud Run service on its custom domain. Public access is the definition of the deployment, never an optional later stage, a prerequisite stage or a fallback.
- Public website access is not public administrative access. Payload admin authentication, CMS write authorization and Secret Manager protection are unchanged.
- The security release gate is preserved and now sits explicitly **before exposure**: with an uncleared gate the deployment is BLOCKED and reported; it is cleared by a verified fix or the Director's recorded decision.
- An organization policy that forbids public access is a reported blocker. It is not weakened without Director authorization.

## What changed, by file

| File | Change |
|---|---|
| `CLAUDE.md`, `AGENTS.md` (identical) | Mission, scope, plan step, startup example, folder map, §4.2 build identity, §4.9 rewritten as “Public website by default; security release gate before exposure”, §4.10 success definition and statuses, phase rhythm, override protocol, version history |
| `SKILL.md` | Description, role, Phase 0 intake, Phase 3 explicit public invocation + readback + domain mapping, Phase 4 rewritten around anonymous verification and one of four statuses, anti-patterns, completion criteria |
| `README.md` | Quick start and guardrails |
| `workflow/00`, `02`, `03`, `04` | Public target in the plan; public-access feasibility checks; dedicated build identity; public deploy, readback, domain mapping; Phase 4 rewritten; fail-closed section |
| `decision-trees/service-exposure.md` | Rewritten: chooses the public-access **mechanism**, never whether the site is public |
| `references/PUBLIC-DEPLOYMENT-CONTRACT.md` | **New.** Success items A–L, check rules, statuses, fail-closed reporting |
| `references/CONFIG-CONTRACT.md`, `SECURITY-GATES.md`, `EVIDENCE-AND-RECOVERY.md`, `SOURCES-AND-LINEAGE.md` | New config fields; gate wording; evidence chain ends at anonymous HTTP evidence; CLI flags checked |
| `scripts/validate-config.py` | `gcp.public_access` required (`allusers-invoker` / `invoker-iam-disabled`), no default and no non-public value; legacy `visibility: private` rejected; `gcp.custom_domain`, `gcp.build_service_account`, `release.security_gate` required; `public_verification` |
| `scripts/render-operator-scripts.py` | `deploy.sh` always passes the public flag, refuses while the security gate is blocked, reads public invocation back (exit 4 if not in effect), then runs anonymous verification; new `map-domain.sh` and `verify-public.sh`; `build.sh` uses the dedicated build identity; optional startup probe and always-allocated CPU |
| `scripts/verify-runtime.py` | Rewritten. Anonymous only, with no credential option; checks the service URL and the custom domain; DNS and certificate validity; homepage, routes, article, images, static assets, ISR headers; admin login; application-level denial of protected reads and of a write probe; tells a Cloud Run IAM denial from an application denial; exit 0 / 1 / 3 |
| `templates/` | Config example (public fields, security gate, verification), release approval, checklist with contract items A–L and four verdicts, explicit Cloud Build logging mode for a dedicated build identity |
| `examples/` | Both rewritten for the public flow, including an INCOMPLETE report |
| `tests/selftest.py` | 6 tests → 21 |

## Removed

Removed and no longer available: the private service option and its deploy flag, the credential-bearing verification option, the “stop at the generated URL” rule, the restricted-access default in the exposure decision tree and in the example config, and every instruction that treated an unreachable website as deployed.

## Not changed

Secret handling, upload guard, staging and hashing, build-time database decision tree, immutable-digest deployment, operator-executes-cloud-writes model, Gate D ownership by independent QA.

## Verification status

Offline only: 21 self-tests, a text audit and static checks. The public-access flags were checked against installed Google Cloud SDK help text but **no cloud command was executed**. The skill has still not performed a real deployment.
