# Source lineage and official mechanics

This skill is a NEW assembly grounded in the operator-supplied, historically used materials:

- `web-factory-cloud-deploy` v1.1 ZIP: portable two-path activation; source/immutable image chain; explicit .gcloudignore and effective-upload guard; isolated staging; operational readback; no automatic DNS.
- `nextjs-cloud-deploy-agent-skill` v1.3 ZIP: config-driven discovery, runtime/Build/Operator identity separation, operator-run `.env` → Secret Manager helper, IAM truth and anti-patterns.
- `APP_FACTORY_SKILLS_PLAYBOOK.md` v1.1: CLAUDE.md manager, skill-v2 SKILL.md methodology, Plan Mode, independent path, evidence labels, version history, folder ZIP root.
- `STARK_FACTORY_CLOUDRUN_DEPLOYMENT_PLAYBOOK_v4.md`: Actor A/B/C and Path A factory setup versus Path B app deployment, three-layer secret mapping, release identity.
- `APP_FACTORY_DEVOPS_OPERATING_MODEL_v1.0.md`: operator-controlled cloud changes, QA Gate Q and Gate D separation.

**Status:** package authored 2026-11-15; portable helper self-tests are local/offline only. Cloud Build, Cloud Run, Turso, R2 and live rollback **have not been exercised by this new skill**. The two parent skills' successful historical use is not a certification of this new package.

Check current versions/CLI flags before generating executable cloud commands:
- Next.js official ISR: https://nextjs.org/docs/app/guides/incremental-static-regeneration
- Next.js standalone output: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Next.js self-hosting/cache: https://nextjs.org/docs/app/guides/self-hosting
- Cloud Run container contract: https://cloud.google.com/run/docs/container-contract
- Cloud Run secret bindings: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Build secrets: https://cloud.google.com/build/docs/securing-builds/use-secrets
- Cloud Build identity: https://cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts
- Cloud Run deployment: https://cloud.google.com/run/docs/deploying
- Effective gcloud upload: https://cloud.google.com/sdk/gcloud/reference/topic/gcloudignore

Prior examples might use deprecated flags or old default service-account conventions. Installed CLI help and current official references govern actual commands.

- Docker BuildKit secret mounts: https://docs.docker.com/build/building/secrets/
- Cloud Run public access and the invoker IAM check: https://cloud.google.com/run/docs/securing/managing-access
- Cloud Run custom domain mapping: https://cloud.google.com/run/docs/mapping-custom-domains

**v1.1:** the public-access flags (`--allow-unauthenticated`, `--no-invoker-iam-check`), `gcloud builds submit --service-account` and `gcloud beta run domain-mappings create` were checked against Google Cloud SDK 593.0.0 help text on 2026-11-15. They were not executed.
