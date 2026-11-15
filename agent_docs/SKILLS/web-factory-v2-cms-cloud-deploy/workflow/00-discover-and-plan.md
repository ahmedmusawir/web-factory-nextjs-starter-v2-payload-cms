# Phase 0 — Discover, classify, present plan

## Read-only actions

- Resolve `SKILL_ROOT` from this skill path, `APP_REPO` from `git rev-parse --show-toplevel` or operator answer. Never guess a home path. Do not search the entire filesystem without a reason.
- Run `python3 "$SKILL_ROOT/scripts/inspect-repo.py" --repo "$APP_REPO"`; inspect package.json, lockfile, Next version/next.config, actual `distDir`, Payload config and database/media plugins, npm scripts, existing Docker/Cloud Build files and manifest. Do not read env values into the agent transcript. Look at key names and absence/presence only via helper.
- Record `git branch --show-current`, `git rev-parse HEAD`, `git status --porcelain=v1`, `git diff --stat`, untracked files; no pull, reset, clean, commit, switch or auto-stash. If dirty, present exact impact of releasing working-tree snapshot vs creating a QA-accepted commit. For POC, snapshot needs explicit approval and file hashes.
- Read existing QA/evidence docs: distinguishing engineer findings vs independent QA verdict. Record exact security advisories with source/version; do not guess vulnerability resolution. Verify actual source env guards for remote Turso and R2; a configured value does not ensure a running container uses it.
- Check gcloud executable in actual shell, `gcloud auth list --filter=status:ACTIVE --format='value(account)'`, `gcloud config get-value project` and project access if authenticated. Observe existing service/project/region only if known or supplied; do not presume an example. Inspect historical deployment service name from repo config, BUT never assume it is the target.
- Public-access feasibility, read-only: check the effective organization policy on allowed IAM members, how sibling services in the project are exposed, whether the custom domain is verified for the operator, whether a domain mapping already exists and what the DNS record currently resolves to. A policy that forbids public access is a BLOCKER to report in the plan.
- If `gcloud` absent, offer installation/login exact instructions for observed OS; never log in on behalf of operator. Docker absent is not fatal if Cloud Build usable. `git ls-files -z` records are filenames, not proof of cleanliness.

## Plan response

1. EVIDENCE: repo/path/branch/HEAD/dirty status; Next/Payload adapter; configured env-key NAMES; QA report path and status; Docker/Cloud Build config found.
2. INFERENCE: deployment is eligible for Cloud Run standalone if build and secret handling validate.
3. QUESTION: only genuinely missing GCP project/region/service name/custom domain, intended service ownership, the security gate decision if it is not cleared, and packaging scope. Public access itself is not a question: it is the target.
4. PROPOSED: new **public** service on the custom domain, the public-access mechanism that fits the project, dedicated build and runtime identities, existing Turso and R2, no data copying, no migration on host move; specific packaging/secret/IAM checks and release steps. State the security release gate as cleared, Director exception or BLOCKED.
5. STOP: **“Awaiting your approval of this plan; nothing has been deployed.”**

Do not list a wall of unfilled YAML variables as questions. Determine what is known and propose sensible **clearly labeled** values for approval, not silent defaults. Existing services are protected assets.
