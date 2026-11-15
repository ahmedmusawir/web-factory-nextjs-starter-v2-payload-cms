# Illustrative first-deployment conversation — not live config

Tony: Repo /path/to/site. Read /path/to/web-factory-cloud-deploy/CLAUDE.md and prepare deployment.
Agent: Main identity verified. gcloud absent; standalone absent. Please provide project ID/account. I propose public run.app, region and small instance limits. May I install the official CLI and make only the standalone packaging addition? No cloud write yet.
Tony: Supplies actual account/project and authorizes those two prerequisites.
Agent: Performs prerequisites itself, reports build output and exact selective Git commands if needed. Provides verified gcloud auth login command for Tony. Ends turn; no hidden question.
Tony: Logs in and supplies committed packaging SHA.
Agent: Verifies identities/cloud target; prepares package, tested scripts, effective upload boundary, missing-resource/IAM plan and rollback/first-release recovery. Shows concrete plan and gaps.
Tony: Approves the specified package, destination, exposure and cloud changes.
Agent: Rechecks boundaries; executes authorized operations; submits one build and retains ID. If long, returns status/ID and next monitor action without duplicate submission. Resolves successful image digest and deploys it. Verifies operational result and hands URL/revision/evidence to QA.
QA: Independently performs application checks. DevOps does not self-certify.

Redeploy: reuse verified target and inspect current state, bind new accepted source/package, present material differences. Existing authorization applies only if it covers this exact release/action. Do not install another backend or import App Factory secret templates.
