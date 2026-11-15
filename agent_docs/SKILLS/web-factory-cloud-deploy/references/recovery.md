# Recovery, responsiveness and evidence

## Waiting and failure
Keep RUN_RECORD.md outside upload with current stage, source, config/package hashes, last completed operation, external operation IDs and next action. Append ISSUES.md rows: observation, cause if established, remedy, outcome, skill correction needed, outside intervention. Record as you go; do not leave the only evidence in an undelivered final reply.

Bob may hide nonfinal messages and interactive clarification tools. End the turn with a plain question when input is needed. Do not invoke an invisible long-lived ask-user tool. Harness approval remains mandatory; refusal stops that operation, not permission to disguise/retry it. Do not bundle optional deletion with copy/build. Stop/refresh/browser disconnect does not prove worker or cloud cancellation. Recheck old worker/process/build identity before resume; never automatically reissue work after transport timeout.

Unavailable tooling: report early; propose remedy and execute only authorized installation. Unknown cloud intent: continue independent local preparation, leave config blank, return all questions together. No indefinite polling; return the existing build ID/state if waiting for cloud work. Do not invent progress/ETA or claim that prose can fix a bridge UI defect.

## Rollback / first deployment
Capture existing revision and complete traffic allocation before changes. Produce exact rollback commands from those observed values (gcloud run services update-traffic syntax verified for installed CLI); require incident authorization unless the approved release plan already includes that contingency. Do not run rollback as a test. On first deployment there is no prior revision; propose a concrete withdrawal action for review (access restriction or service deletion have different effects). Never perform it by default or call it rollback to a nonexistent revision. Preserve evidence and resources until directed.

## QA handoff fields
- Source SHA and any accepted packaging diff; acceptance record or explicit Director POC exception.
- Plan/authorization reference; package/upload inventory hashes.
- Account/project/region/service; build/runtime identities.
- Build ID/status; immutable digest; revision; URL; traffic/access/ingress readback.
- Operational startup/access/static asset checks, safe logs, checks NOT RUN.
- Previous service/traffic and recovery commands; open limitations.
- Actual routes from source for QA, business caveats already in contract. Do not invent route names.
- QA owns application tests and Gate D. Successful deployment alone is not certification.
