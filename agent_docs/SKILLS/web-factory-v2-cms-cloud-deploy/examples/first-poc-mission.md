# Example context: first Web Factory V2 Payload/Turso/R2 site (NOT defaults)

This is historical project information supplied by operator/engineering; it is **CLAIM** until checked against active repo, QA report and service. NEVER copy these repo paths, URLs, service names, project accounts or credentials into another site's deployment.

- Repo reported: `web-factory-nextjs-starter-v2-payload-cms`, prior local path `/home/moose/NEXTJS/NEXTJS_PAYLOAD_SQLITE_TEST/web-factory-nextjs-starter-v2-payload-cms`.
- Reference static site read-only: sibling `web-factory-poc-site-1`; previously deployed on Cloud Run under a static Web Factory skill.
- Branch reported: `feat/p1-payload-turso-gcs-poc`, working changes uncommitted when Mission 003 engineering completed.
- Local app reported `http://127.0.0.1:3001` with a custom build dir `.next-mission003`; **verify actual distDir and standalone server path before copying Docker template**.
- Remote DB reported: Turso `web-factory-v2-poc-db`, remote AWS Singapore; actual DB URL/host comes from operator-side environment, **do not print token**.
- Media bucket reported: Cloudflare R2 `stark-web-factory-poc-media`; R2 public development URL may not be a production-grade custom domain.
- Site reported: original 7 Payload pages; 12 WordPress blog posts; new blog media 44 originals + 44 thumbnails; previous media preserved; 30-second ISR instrumented PASS from Cody.
- Operator manually tested blog and reported PASS; independent Claudy Mission 003 QA was underway at skill authoring time.
- Critical Monaco/DOMPurify advisory unresolved at time of handoff: **EXPOSURE BLOCKED pending verified fix or Director-approved security disposition.**
- Docker image build was untested locally due to unavailable Docker when Mission 003 finished; Cloud Build may provide deployment proof if upload/secret/security gates pass.

### Safe first-run posture

- Discover real GCP project, region and actual service names from current CLI/current source. Don't assume older deployment names or overwrite an existing service.
- Propose a NEW public service on the intended custom domain and existing Turso DB/R2 bucket, no data copy or schema migration for mere host move.
- Inspect build-time DB needs: ISR route prerender may require Turso during `npm run build`. Do not assume runtime-only Docker build will succeed.
- QA and the security release gate are settled before exposure; while the critical advisory has neither a fix nor the Director's recorded decision the deployment is BLOCKED, and it is reported that way.
