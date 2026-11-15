# Example two-actor interaction (not commands to execute verbatim)

**Tony:** “Use the skill in `/portable/skills/web-factory-v2-cms-cloud-deploy`; our Payload site is my current working folder.”

**Agent:** “EVIDENCE: found Next/Payload project on dirty branch, remote Turso and R2 variable names, and `output: standalone`. CLAIM: engineering says 30-second ISR works; QA report not found. The target is a new public Cloud Run service on your custom domain, with existing DB/bucket and operator-run secret upload. The security release gate reads BLOCKED: one critical advisory has no fix, so exposure needs a fix or your recorded decision. Question: confirm GCP project/region/service/domain and that you approve only local package preparation.”

**Tony:** “Approved for packaging, no deployment.”

**Agent:** “Prepared release in `/tmp/.../staging` with source and SHA-256 inventory. `.gcloudignore` effective listing PASS. Docker local test NOT RUN. A build-time Turso read is a GAP; here is the minimal protected-build decision needed. I have made no cloud changes.”

**Tony:** “Use the build-time secret route and approved runtime secret versions. I accept the advisory for this POC; here is my written decision. Go ahead.”

**Agent:** “Recorded your decision as a Director exception in the config; it is not a security PASS. Before a cloud write, I will show the exact build identity, proposed per-secret IAM, service name and public-access mechanism. Please run the operator-side secret-upload command; it reads your local env file and doesn't show values. After the verified build I will derive the image digest and give the final deploy command, then the domain-mapping and verification commands. Existing services remain untouched.”

**Agent after deployment:** “EVIDENCE: build ID X, digest sha256:..., revision Y, runtime SA verified, `allUsers` invoker confirmed by readback. Anonymous verification: service URL PASS; custom domain certificate still provisioning. STATUS: DEPLOYMENT INCOMPLETE. Next: rerun `verify-public.sh` once the mapping is Ready; I will not report this deployed before that passes.”

**Agent, later:** “STATUS: PUBLIC ACCESS VERIFIED on both URLs: homepage, blog, article, images 200; admin login reachable and uncached; anonymous write rejected by the application. Publish-driven ISR is handed to QA for Gate D. Security: live under your recorded exception; the advisory is still open.”
