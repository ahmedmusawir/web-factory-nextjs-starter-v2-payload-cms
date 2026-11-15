# Version and provenance

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-11-15 | New portable, Cloud Run-first Web Factory V2 CMS deployment Stark Skill. |
| 1.1 | 2026-11-15 | Director doctrine correction: **Web Factory deployment = public website.** The restricted-access-first stage of v1.0 is revoked and removed from every document, template, script and test. See `CHANGES-v1.1.md`. |

Built from two field-used skills supplied by the operator: `web-factory-cloud-deploy` v1.1 (static website packaging/release safety) and `nextjs-cloud-deploy-agent-skill` v1.3 (Secret Manager/IAM/config). Reconciled with `APP_FACTORY_SKILLS_PLAYBOOK.md`, `STARK_FACTORY_CLOUDRUN_DEPLOYMENT_PLAYBOOK_v4.md`, `APP_FACTORY_DEVOPS_OPERATING_MODEL_v1.0.md`. This package was authored and helper-tested offline; it has **not** yet executed a Cloud Run deployment. No field-verified badge until the POC is deployed and passes the public deployment contract.

| 1.2 | 2026-11-15 | Mandatory persistent four-file toolchain in every website Git repo; historical successful examples carried inside skill; self-contained operator redeploy runner and installer; PUBLIC doctrine preserved. |
