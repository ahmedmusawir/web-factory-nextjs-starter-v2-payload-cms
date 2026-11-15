# v1.2 DIRECTOR OVERRIDE — PERMANENT FOUR-FILE REDEPLOY CONTRACT

**MANDATORY BEFORE DECLARING A WEBSITE DEPLOYMENT COMPLETE:** install and verify the four versioned files **inside the website repository root**: `Dockerfile`, `cloudbuild.yaml`, `init-app.sh`, `deploy.sh`. Also retain `.dockerignore`, `.gcloudignore`, `stark-deploy.json` (never secret payloads) and `ops/` repo-local helper scripts. After initial infrastructure provisioning, the owner must be able to run **`./deploy.sh` alone from the website checkout** to build current source, resolve image digest, redeploy publicly and anonymously verify both URLs. No skill-folder path dependency or temporary-only scripts. See `references/PERMANENT-REDEPLOY-CONTRACT.md`, `scripts/install-repository-toolchain.py`, and **read all four exact historical examples** in `examples/field-proven-four-files/` before preparing CMS versions. The second proven complex-app four-file set is in `examples/app-skill-v1.3-proven/`. These examples are history, never blindly executed.

**Existing v1.1 guidance that renders operator scripts only outside the repository is superseded for lasting artifacts.** Temporary secure staging for Cloud Build remains required, but the canonical deployment files MUST be committed inside the website repo. Treat missing four files or a one-shot external deployment as **DEPLOYMENT PROCESS FAIL**, even if the website is already live.

# Web Factory V2 CMS Cloud Deploy — Stark Skill v1.1

**Drop this folder anywhere.** Supports Claude Code (`CLAUDE.md`) and Codex (`AGENTS.md`) with identical entry-point instructions.

This is a **Stark Skill**: it guides the operator's **public** deployment of a Next.js + Payload CMS website with the same remote Turso/libSQL database and Cloudflare R2 bucket across local development, Cloud Run staging and (later) Vercel production. It does not move data merely because the frontend host changes.

## How to start

1. Extract the ZIP anywhere (one top-level folder `web-factory-v2-cms-cloud-deploy/`).
2. Open your agent in the TARGET website repository, if possible.
3. Tell Cody or Claudy: **Read `/absolute/or/relative/path/to/web-factory-v2-cms-cloud-deploy/AGENTS.md` and guide me.** For Claude Code use `CLAUDE.md`. If the agent is elsewhere, it will ask for the target repo once.
4. The agent does read-only intake, proposes a public deployment plan (service, public-access mechanism, custom domain, security gate status), asks for missing GCP facts, and awaits approval. No need to hand-fill templates beforehand.
5. The operator performs approved Cloud Run/IAM/secret-upload/domain-mapping commands, one checkpoint at a time. The agent produces and verifies the package and records evidence.
6. The deployment is finished only when the anonymous verification passes on the Cloud Run URL **and** the custom domain.

## Core guardrails

- Existing Turso DB and R2 bucket remain external and unchanged by a host move.
- Schema migrations are independent, controlled operations only when code/schema actually differs.
- Build-time access to Turso may be needed by Next ISR prerendering: inspect and plan it; never use Docker ARG secrets.
- `.env` secret values stay in the operator's local terminal; `scripts/operator-upload-secrets.py` sends directly to Secret Manager via stdin after approval.
- Both `.gcloudignore` and `.dockerignore` must exclude sensitive input; `scripts/check-upload.sh` verifies the effective upload tree.
- **Websites are public by default.** Cloud Run deployment is by immutable digest, to a **new service** by default, with public invocation configured explicitly and read back. There is no restricted-access first stage and no such fallback.
- **Public website access is not public administrative access:** Payload admin and CMS writes stay behind application authentication and authorization.
- A deployment is complete only when anonymous visitors reach it: see `references/PUBLIC-DEPLOYMENT-CONTRACT.md`. A Cloud Run IAM 401/403 is a deployment failure; a custom domain still provisioning is DEPLOYMENT INCOMPLETE.
- Security issues and QA approval are explicit release gates before exposure, not automatic waivers. A blocked gate means BLOCKED, reported honestly.
- Existing Cloud Run services stay untouched. Records at the DNS provider are edited by the operator; the skill maps the domain on Cloud Run and verifies the result.

The `examples/first-poc-mission.md` file documents an initial Cyberize POC and is **not** a hardcoded default for other websites.

## Offline helper self-tests

```bash
python3 /path/to/web-factory-v2-cms-cloud-deploy/tests/selftest.py
```

Passing tests validates only portable helper behavior, NOT Cloud Run readiness or a real deployment. See `references/SOURCES-AND-LINEAGE.md`.

`render-operator-scripts.py` produces the familiar **`init-app.sh`, `build.sh`, `deploy.sh`** operator scripts plus **`map-domain.sh`** and **`verify-public.sh`** from an approved project-specific config. They remain outside the Cloud Build upload tree and do not execute during generation.
