# Deployment — cyber-cms-poc-1 (public Cloud Run)

Public URL: https://cyberize-cms.cyberizedev.com
Project `cyberize-nextjs-staging`, region `us-east1`, service `cyber-cms-poc-1`.

## Routine release

```bash
gcloud auth login                                   # as the approved operator in stark-deploy.json
gcloud config set project cyberize-nextjs-staging
./deploy.sh
```

Type `DEPLOY PUBLIC cyber-cms-poc-1` when asked. The script then:

1. checks the active gcloud account, project and that the service exists;
2. copies the **current working tree** (committed or not) to a temporary folder outside the repo;
3. refuses to continue if a secret-looking file would be uploaded;
4. runs Cloud Build as the dedicated build account and waits for it;
5. deploys the built image **by digest** to the same service, public, with the same secrets and runtime account;
6. checks anonymously that the `run.app` URL and the custom domain serve the site, images, ISR headers,
   the admin login, and that anonymous CMS writes are refused;
7. prints the build ID, digest, new revision and the rollback command.

Exit codes: `0` verified, `1` failed, `2` blocked before any cloud change, `3` deployed but the custom
domain is not serving HTTPS yet. `./deploy.sh --verify-only` reruns step 6 without building.
`./deploy.sh --yes` skips the typed confirmation.

Requirements on the machine: `gcloud`, `python3`, `git`, `bash`. Nothing else; no agent, no skill folder.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Next.js standalone + Payload image. Build-time config arrives only as a BuildKit secret mount. |
| `cloudbuild.yaml` | Build and push only. Reads the two Turso secrets from Secret Manager for prerendering. |
| `init-app.sh` | Read-only check that everything `deploy.sh` needs exists. Creates nothing. |
| `deploy.sh` | The one-command release above. |
| `stark-deploy.json` | Non-secret settings: target, identities, secret names and pinned versions, security decision. |
| `.gcloudignore`, `.dockerignore` | What may be uploaded to Cloud Build / copied into the image. |
| `ops/redeploy.py`, `ops/check-upload.sh`, `ops/verify-runtime.py` | Implementation behind the two scripts. |

## Things that are not part of a routine release

- **Secrets.** Values live only in Secret Manager. To rotate one, add a new version there and update the
  pinned `version` in `stark-deploy.json` (and in `cloudbuild.yaml` for the two Turso secrets), then deploy.
- **Security decision.** `release.security_gate` in `stark-deploy.json` carries the Director's exception
  for the Monaco/DOMPurify advisory and its expiry date. After that date `deploy.sh` refuses to run until
  a renewed decision (or a fix, status `cleared`) is recorded there.
- **First-time setup** (service accounts, secrets, IAM grants, first deploy, domain mapping) was done once
  and is not repeated by `deploy.sh`. `./init-app.sh` tells you if any of it is missing.
- **Database and media.** Deploying never migrates Turso and never touches R2 objects.
- **DNS.** `cyberize-cms` CNAME → `ghs.googlehosted.com.` is already in place; deploys do not change it.

## Rollback

`deploy.sh` prints the exact command after each release, of the form:

```bash
gcloud run services update-traffic cyber-cms-poc-1 --project=cyberize-nextjs-staging --region=us-east1 \
  --to-revisions=<previous-revision>=100
```

The next `./deploy.sh` sends traffic to its new revision again.

## Cache behaviour

Pages revalidate every 30 seconds. The cache is in memory only (`experimental.isrFlushToDisk: false` in
`next.config.mjs`), capped by Next.js at 50 MB per instance, and starts from the build-time snapshot after
a cold start. The service runs a single instance.
