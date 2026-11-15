# Evidence, identity and recovery records

Every meaningful status claim uses:
- **EVIDENCE** — observed file/command with path/ID.
- **INFERENCE** — hypothesis derived from evidence, not tested.
- **CLAIM** — Cody/Claudy/operator said it; independently unverified.
- **GAP** — expected evidence/permission absent.
- **QUESTION** — needs operator intent.

Before cloud changes save: repo URL/branch/commit, dirty status or reviewed snapshot, per-file staging SHA-256 manifest, actual project/region/service, Actor A/B/C, what cloud resources will be created/reused, runtime secret NAME/version mapping, old revision/traffic/ingress/identity and exact release authorization. Keep artifacts **outside Cloud Build upload**. Never store auth tokens.

After: Cloud Build ID/status, image registry and immutable digest, Cloud Run revision, effective image digest, traffic, service URL, ingress, public-invocation mechanism and readback, domain mapping and certificate state, anonymous verification output and status line for both URLs, CMS/ISR checks, QA Gate D owner, remaining blockers. Log failures and checks NOT RUN. A service URL alone is not a release identity.

Rollback: restore traffic to observed prior known-good Cloud Run revision only with appropriate incident authorization. On a new service no prior revision exists, so an emergency withdrawal is an operator-approved incident action recorded as an outage, NOT a fictional rollback and never a deployment state. For interrupted builds/deploys, check existing build/service first; never rerun blindly. Keep existing services untouched.
