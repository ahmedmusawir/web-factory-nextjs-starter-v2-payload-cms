# Turso + Cloudflare R2 POC setup

**Live engineering verification PASS on the approved disposable targets.** Only `web-factory-v2-poc-db` and `stark-web-factory-poc-media` were used. Migration, real upload/delivery, restart persistence and cleanup passed. The bucket is empty; the database retains its schema, one migration record and default Site Settings. No reusable test administrator remains. [Engineering evidence and limitations](MISSION-001-HANDOFF.md).

The Director corrected `.env.local`; all target confirmations now pass. The file remains Git-ignored, mode `600`, and unchanged by engineering. Keep secrets in ignored environment files or a secret manager, never chat or Git. The Monaco security finding remains a production-release blocker.

## Director setup

1. Approve one empty disposable Turso database and one dedicated R2 bucket for **public editorial images only**. A prefix is organizational, not a security boundary.
2. In R2 bucket Settings, enable the **Public Development URL** only for that approved public bucket. Copy its exact `https://…r2.dev` origin. Enabling this exposes every object in the bucket, irrespective of Payload visibility. Never put private files in this bucket. R2.dev is rate-limited development delivery; production caching requires a separately planned custom-domain setup. [Cloudflare public bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/).
3. Create R2 S3 credentials with **Object Read & Write**, scoped to this bucket only. Do not use Admin Read & Write or all-bucket scope. Verify object create/read/list/delete permission for Payload replacement/deletion workflows, without bucket provisioning or policy privileges. Store the Access Key ID and Secret Access Key securely. [Cloudflare token permissions](https://developers.cloudflare.com/r2/api/tokens/).
4. Obtain a token scoped only to the approved Turso database. Confirm the database hostname and bucket name before configuring the application.

## Exact configuration

Use the approved settings in ignored `.env.local` or the process environment:

```dotenv
APP_ENV=test
DATABASE_KIND=turso
DATABASE_URL=libsql://<approved-disposable-database-host>
DATABASE_TARGET_HOST=<same-database-host>
DATABASE_AUTH_TOKEN=<install-privately>
PAYLOAD_SECRET=<stable-random-secret-installed-privately>
MEDIA_STORAGE=r2
R2_BUCKET=<approved-public-editorial-bucket>
R2_TARGET_BUCKET=<same-approved-bucket>
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<install-privately>
R2_SECRET_ACCESS_KEY=<install-privately>
R2_PUBLIC_URL=https://<copy-exact-public-host-from-dashboard>.r2.dev
R2_PREFIX=<site-id>/editorial
```

The CLI now uses `@next/env@16.4.3`, matching Next.js loading and interpolation rules: shell values override files, and `.env.local` overrides `.env`. Mode-specific `.env.production.local` / `.env.development.local` files have higher file priority when present. `APP_ENV=test` is the application target guard; **do not set `NODE_ENV=test` to select remote testing**, because Next.js intentionally skips `.env.local` in that Node mode. Literal `$` characters in environment file values must be escaped as described in Next.js environment documentation.

Use the dashboard's jurisdiction-specific S3 endpoint if applicable (`eu`, `us`, or `fedramp`). `R2_ENDPOINT` is an HTTPS account API origin, with no bucket/path/query; it is never an image URL. `R2_PUBLIC_URL` is a separate HTTPS delivery origin, with no path/query/credentials. `R2_PREFIX` is required for remote object keys; `MEDIA_PREFIX` is only for local mode. No variable is prefixed `NEXT_PUBLIC_` and no credentials are passed as browser props.

The adapter uses `region: 'auto'`, `forcePathStyle: true`, explicit server-side credentials, no object ACL override, no bucket creation, and `clientUploads: false`. Public original/thumbnail URLs are built from the delivery origin plus stored prefix/filename, not from the S3 endpoint. Payload write/access checks remain active. [Payload S3/R2 contract](https://payloadcms.com/docs/upload/storage-adapters), [Cloudflare AWS SDK configuration](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).

Only `sqlite + local` or `turso + r2` combinations are accepted. Local/test SQLite stays within `.data/local/` or `.data/test/`. Preview/production rejects local bytes and databases; Vercel environments must match `APP_ENV`. Missing remote settings or target mismatches fail closed. Target confirmations prevent configuration mistakes; scoped credentials provide the actual storage/database security boundary.

## CORS and upload path

Uploads go from browser → authenticated Payload API → authenticated R2 S3 API. **No browser PUT/signing endpoint is enabled, so upload CORS is not required.** Simple `<img>` display also does not require CORS. If using admin crop/canvas tools that fetch public image bytes, configure a narrow read policy on the approved bucket, substituting the actual future admin origin when needed:

```json
[
  {
    "AllowedOrigins": ["http://127.0.0.1:3001"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Do not add browser PUT or expose API keys. A future direct-upload phase must use Payload's supported signed-upload flow, authenticate signing, validate receipts, and review CORS separately. [R2 CORS documentation](https://developers.cloudflare.com/r2/buckets/cors/).

The current file limit is 3 MiB, JPEG/PNG/WebP only. Vercel has a 4.5 MB function request limit including multipart overhead; large uploads and deployment have not been verified. No production-readiness claim follows from a local test.

## Live verification — run only after resource approval

1. Review the generated foundation migration and inspect the disposable database. The approved POC already has this migration applied; do not reset it. On a newly approved empty target only, set `MIGRATION_TARGET_HOST` to the exact approved hostname and run `npm run db:migrate`; use `npm run db:status` to inspect the current POC. Build/start never migrates automatically. Do not run reset/fresh/down against remote data.
2. Set `BOOTSTRAP_TARGET_HOST` to the same hostname. Use the README's hidden terminal password-entry procedure and `npm run admin:create`. It refuses an existing user collection. Start with `npm run dev` (loopback only), then log in at `/admin`.
3. Attempt an image upload with private/default visibility: it must fail, without creating an object or database record. Then choose **public** explicitly and save a small real image. This is deliberate publication, not a private staging step.
4. In Cloudflare's authorized dashboard, confirm original and thumbnail objects exist under `R2_PREFIX`; compare the media record's `objectKey`, filename, variant filename, MIME, dimensions and sizes. Confirm new bytes were not written under `.data/local/media` or `.data/test/media`.
5. Open the returned original/thumbnail URLs signed out. They must use `R2_PUBLIC_URL`, return real images, and contain no API endpoint, credentials or signed-write parameters. Confirm anonymous Payload writes still fail. Attempt to change the record to private: it must be rejected. Already public bytes cannot be made secret through a database flag.
6. Create/publish a Post referencing the image and update settings. Verify the records/relationship in the dedicated Turso database using an authorized operator tool. Stop/restart the app; log in, read records and public image bytes again. Record actual results separately from local evidence.
7. On disposable fixtures only, test replacement/deletion and inspect both original/variant objects. Cached copies may outlive deletion; do not use public storage for secrets.

Changing configuration does not copy local files to R2 or move existing prefixes. Use a fresh remote POC database; migrating existing media is separate reviewed work. Local private media behavior remains unchanged. Private cloud files need a separate private bucket/access-controlled delivery design, not a different prefix in this public bucket.

## Current status and independent QA

No credentials/configuration blocker remains for the bounded integration. Run `node --import tsx scripts/verify-remote.ts --approved-live-poc` only when those same disposable targets are still approved and have no existing users/content or objects under the test prefix. It generates an administrator password in memory, performs the browser/API/restart workflow, removes its own fixtures and restores settings. It never runs migrations or deletes an existing operator's content. Keep port 3001 free.

For manual QA, use your own CLI-created admin and the steps above. R2 operations were verified on the authorized bucket; cross-bucket/account token scope was not independently certified. The critical Monaco/DOMPurify finding still blocks production release. No QA certification or deployment approval is implied.
