---
name: web-factory-cloud-deploy
description: Guide a local Web DevOps agent from a Next.js website repo through intake, secret-free packaging, approved Google Cloud Run deployment and QA handoff. Use for Web Factory deployment preparation, first deployment, redeployment and recovery. Excludes CMS, database, application repairs, DNS and QA certification.
---

# Web Factory Cloud Deploy v1.1

Begin with [AGENTS.md](AGENTS.md) or identical CLAUDE.md. Follow applicable repo instructions. Read [workflow.md](references/workflow.md) for execution, [package-contract.md](references/package-contract.md) before generating files, [recovery.md](references/recovery.md) on blocks/restarts, and [first-deployment.md](examples/first-deployment.md) for the operator interaction pattern. Populate [stark-web-deploy.yaml](references/stark-web-deploy.yaml) yourself; Tony provides intent in ordinary language.

1. **Intake:** identify repo/commit/status, environment/tooling and standalone/config dependencies. Return one short visible reply with all missing decisions. No long build before this reply.
2. **Resolve prerequisites:** obtain account/project intent; verify actual CLI environment and cloud reads. Offer installation/login remedies for missing CLI. Handle a minimal standalone change only under explicit packaging authorization. Preserve product lock and source identity.
3. **Prepare:** stage committed source plus reviewed packaging outside checkout; adapt templates, record diffs/hashes/inventory, validate upload exclusions, syntax and available build/startup checks. Read the generated scripts before running them. Never execute example values.
4. **Present release:** show account/project/region/service, public/private exposure, build/runtime identities, resources/IAM created or reused, source/package identity, acceptance provenance, limits, checks not run, previous traffic and recovery. Obtain concrete authorization before cloud writes. Preparation can proceed with blank cloud values; execution cannot.
5. **Deploy:** recheck source/account/authorization, run upload guard from exact tree before EVERY submission, build/push unique image, resolve immutable digest, deploy that digest with explicit identity/access/limits, read back service/traffic/access. Stop on failure; no blind retry.
6. **Hand off:** check startup and intended access, retain safe operational logs/identity chain, give QA the live URL and revision for independent application verification. Do not run application QA campaign or certify Gate D yourself. Stop at run.app; DNS is separate.

Never infer account/service-account identities, silently enable APIs/grant IAM, inspect secrets, reset Git or deploy latest. Keep runtime assets/licenses. A denied read is not a missing resource. Docker is optional when Cloud Build performs the container build: record local container test as NOT RUN and verify actual cloud startup later, not a fabricated local pass.

This is a procedural execution kit with reference templates and an upload guard. It generates repo-specific deployment scripts; it is not a universal pretested deploy.sh. Local validation is not live deployment evidence. Pinned framework and current official CLI documentation control exact commands.
