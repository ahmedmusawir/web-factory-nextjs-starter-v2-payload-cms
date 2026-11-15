**v1.2 ADDENDUM:** Site-specific `APP_ENV` must match the actual app; `preview` applies to the initial Payload POC. Do not use `staging` if the app rejects it.

# Safe, portable configuration contract

The file `templates/deployment-config.example.json` is a **schema/example**, not a live target. Agent creates a populated configuration outside the Cloud Build upload tree. `scripts/validate-config.py` validates baseline shape/names/no-secret-values with standard Python3. No PyYAML dependency; do not duplicate the config in YAML unless the implementation requires and verifies it.

Fields:
- `app.name`: short kebab-case identifier; not a repo path.
- `app.repository`: path DISCOVERED at launch (not an example path); source identity stays recorded separately.
- `app.next_dist_dir`: actual Next `distDir`, not guessed; default `.next` only if source confirms.
- `gcp.project_id`, `gcp.region`, `gcp.service`: approved real target; service must not be silently taken from old static config.
- `gcp.artifact_repository`: existing Artifact Registry Docker repo; do not auto-create.
- `gcp.expected_operator`: active gcloud account compared to authorized identity.
- `gcp.runtime_service_account`: actual dedicated SA email; no guessed generated value.
- `gcp.public_access`: **required**, `allusers-invoker` or `invoker-iam-disabled`. It selects how public invocation is configured; there is no default and no non-public value. A legacy `gcp.visibility` other than `public` is rejected.
- `gcp.custom_domain`: **required** key. The bare public hostname, or `null` only when the operator approved a deployment without one (success items I and J then do not apply).
- `gcp.build_service_account`: actual dedicated least-privilege Cloud Build SA email; must differ from the runtime SA.
- `gcp.startup_probe_path`, `gcp.cpu_always_allocated`: optional; a health route for the startup probe, and CPU outside requests so background ISR regeneration can finish.
- `release.security_gate`: **required**. `status` is `cleared`, `director-exception` or `blocked`; `reference` cites the evidence or the Director's approval record. With `blocked` the config validates, scripts render, and `deploy.sh` refuses to run.
- `public_verification`: `paths`, `article_path` and `revalidate_seconds` passed to the anonymous verifier.
- `gcp.max_instances` / `min_instances`: integer, with explicit capacity caveat for ISR.
- `gcp.memory`: real Cloud Run memory size; verify current CLI accepts it.
- `runtime_env`: **nonsecret** env variables with verified values (e.g. `APP_ENV`, `DATABASE_KIND`, `MEDIA_STORAGE`, remote target names/host, public origin). Never put `DATABASE_AUTH_TOKEN`, `PAYLOAD_SECRET`, R2 secret, generic `_SECRET`/`_TOKEN` or private keys here.
- `secret_bindings`: map `ENV_VAR` -> `{ "name": "secret-manager-name", "version": "numeric" }`. Values are names and versions, NOT secret payloads.
- `build.profile`: `runtime-only` or `protected-buildkit`; the latter requires separate approved design (see decision tree), never silently enabled.

The validator checks syntax/suspicious values/forbidden secret env keys and does NOT perform cloud IAM or secret-version verification. Operator reviews resolved environment-specific URLs and guards. A complete JSON config is NOT authorization to deploy. The agent must still present the actual plan and await approval.

### DistDir and source mapping

For Next config using a custom build directory, both `Dockerfile` COPY source paths and `server.js` runtime layout must be adapted. Do not blindly set `NEXT_DIST_DIR` at Docker runtime and assume it will change the standalone artifact. Verify with actual `npm run build`, then inspect release's `standalone/server.js`, `.next/static` and copied `public` tree. The template assumes default `.next`; custom cases require a deliberate, tested adjustment.
