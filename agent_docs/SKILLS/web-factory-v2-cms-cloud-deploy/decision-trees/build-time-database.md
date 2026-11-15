# Decision: does `next build` need Turso credentials?

1. Inspect actual Next.js app code, Payload config, static `generateStaticParams` and build logs. **Do not assume**.
2. In an isolated approved test environment with sensitive env vars UNSET, run production build. No live destructive data hooks. If PASS and no remote DB required, choose **runtime-only build** profile; keep Cloud Build secret-free.
3. If FAIL because Payload/ISR needs DB/Payload secret at build:
   - First consider an engineering-approved change to defer DB reads from build, or use a non-sensitive content snapshot; this is a developer task and triggers matching QA.
   - Otherwise propose a controlled **BuildKit secrets** profile: `DOCKER_BUILDKIT=1`, Dockerfile `RUN --mount=type=secret,id=...` with the required secret bytes consumed *only in that RUN*; Cloud Build `availableSecrets`/`secretEnv` for actual build SA; DO NOT use ARG/ENV/COPY to persist private values. Confirm `gcloud`/Docker/buildx support, permissions, logs and egress. Document exact reason for each secret.
   - Build-time prerender will read actual remote content; protect production data from write hooks/migrations/seeding. Validate generated HTML/client bundle and build logs contain no private tokens. Think about which environment's DB is built into public HTML.
4. Under no circumstances pass `DATABASE_AUTH_TOKEN`, `PAYLOAD_SECRET` or R2 secret via Docker ARG or Cloud Build substitutions. Do not stage `.env` in Cloud Build source.
5. If protected BuildKit flow is not independently verifiable, mark **BLOCKED** and return a minimal engineering/build remedy. Do not swap to dynamic rendering just to silence the gate.

The v1.0 defaults implement **runtime-only**. For a protected path inspect `templates/Dockerfile.buildkit-example` and `templates/cloudbuild.buildkit-example.yaml`; they demonstrate ephemeral BuildKit mounts and Cloud Build Secret Manager delivery, but are **a separately adapted and approved package**, not tested automation for the target. Numeric secret versions and actual Build SA IAM must be verified. This is a controlled extension point for the first POC.
