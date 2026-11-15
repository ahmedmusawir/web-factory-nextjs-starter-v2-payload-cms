# Historical field-proven four-file deployment example (exact supplied bytes)

These four files were supplied by the Director in `DEVOPS_SKILL_DELIVERABLES_EXAMPLE.zip` and are preserved **verbatim**:

1. `Dockerfile.txt` (the historical project's Dockerfile content)
2. `cloudbuild.yaml`
3. `init-app.sh`
4. `deploy.sh`

They prove the **operator experience and persistent repository contract**: after initial setup, open the repository and run `./deploy.sh`; the repo contains the full necessary build/deploy machinery. They are project-specific historical examples, **NOT** suitable for direct copy into the Payload/Turso/R2 website. Their old `init-app.sh` provisions a placeholder Secret Manager value and their `cloudbuild.yaml` uses a mutable `latest` tag and a different environment (Supabase); do not run them or use them as secure current templates. The Next.js/Cloud Run app-specific configuration is historical; the v1.2 CMS toolchain adds build-time Turso secrets, immutable digest deployment, anonymous public verification and repository retention.

An agent MUST **read all four** during discovery, explain the differences, and implement **the same four named deliverables** with the new CMS-safe flow. Do not copy old service names, domain names, keys or values into a different website.
