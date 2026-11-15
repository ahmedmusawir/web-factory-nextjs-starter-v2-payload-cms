# Release Plan and Operator Authorization (fill per deployment)

> This file alone grants NO authorization. Approval is the operator's explicit message/record for the named target and planned operations.

- Date and operator:
- Application repo, immutable commit/reviewed snapshot:
- QA decision:
- Security release gate before exposure (cleared / Director exception with record / BLOCKED):
- GCP account/project/region:
- Cloud Run service and ownership (NEW or existing):
- Public access mechanism (allUsers invoker / invoker IAM check disabled) and organization policy readback:
- Custom domain, DNS record owner and current DNS target:
- Existing services: NO TOUCH by default:
- Actor B and Actor C identities:
- Secret Manager names/versions and minimum IAM changes:
- Remote Turso database/R2 bucket reused:
- Docker/BuildKit build-time secret profile:
- Changes to existing resources, effects and rollback:
- Exact operations approved (prepare / IAM / upload / build / public deploy / domain mapping / traffic):
- Explicit operator approval text and timestamp:

**Never assume that “prepare files” includes cloud-write, exposure, domain-mapping or live-data migration authorization. The website is public by doctrine; each cloud write that makes it so is still approved by the operator.**
