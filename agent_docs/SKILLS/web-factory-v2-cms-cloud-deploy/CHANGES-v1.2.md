# v1.2 — Director corrective action: permanent one-command deployment

## Root cause
The v1.1 skill could generate deployment scripts into a temporary/external operations directory and complete a Cloud Run release without ensuring a recoverable, version-controlled `./deploy.sh` in the website repository. This violated the original Stark Factory operational contract.

## Changes
- **Mandatory four files:** `Dockerfile`, `cloudbuild.yaml`, `init-app.sh`, `deploy.sh`, physically retained within each WEBSITE repo.
- **Proven examples embedded:** Director-supplied exact four historical files (`examples/field-proven-four-files/`) plus the complex-app skill v1.3 generated four-file set (`examples/app-skill-v1.3-proven/`). Historical examples are non-executable reference artifacts.
- **Repository installer:** `scripts/install-repository-toolchain.py` requires actual reviewed app Dockerfile, approved Cloud Build YAML and real deployment config. Refuses silent overwrites.
- **Repo-local runtime:** `scripts/redeploy.py` and `templates/repository-*.sh` are installed into the website repo, requiring no dependency on the original skill folder after installation.
- **Operator workflow:** current source -> protected stage -> upload guard -> Cloud Build -> image digest -> same Cloud Run service public update -> invocation readback -> anonymous URL/domain checks, with one `./deploy.sh`.
- **No first-use provisioning on normal redeploy.** `./init-app.sh` checks already-provisioned resources; the first creation stays an approved infrastructure workflow.
- **APP_ENV sample corrected** from an unsupported staging example to preview for initial POC; actual site config must be verified against source.

## Safety limitations
This release and new runner have been tested offline. They are not field-certified until Claudy installs and exercises the four deliverables in the actual repository and proves a repeat public Cloud Run deployment without an agent. The historical examples contain project-specific identifiers and are not safe to run elsewhere. Never upload `.env` or embed secrets in Git.
