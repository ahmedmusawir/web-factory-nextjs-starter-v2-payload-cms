# Mission 001 — R2-001 engineering handoff

**R2 integration implemented. Local foundation verified. Live Turso/R2 pending.** This is engineering evidence, not production readiness or independent QA certification. No cloud resource was accessed, provisioned or modified; no commit, push, merge or deployment was performed.

## Live configuration preflight update

The Director has supplied `.env.local`; it is Git-ignored and mode `600`. **Preflight is blocked**, so no remote request, migration, bootstrap or upload ran. `APP_ENV=local` conflicts with Turso and must be `test` for this disposable integration. `R2_TARGET_BUCKET` is missing; it must confirm the approved `R2_BUCKET`. The migration/bootstrap hostname confirmations are also absent. Required credentials are present; the Turso hostname matches `DATABASE_TARGET_HOST`. Remaining syntax passes only in a diagnostic in-memory copy with the two proposed corrections, not in the actual configuration. The environment file was left unchanged.

Fixed a CLI/application mismatch: `scripts/load-env.ts` now uses exact `@next/env@16.4.3`, so CLI commands honor `.env.local` and Next.js precedence/interpolation. The loader regression uses dummy files and isolated child environments; it never reads project credentials. New evidence is separate in [evidence/live-preflight](../evidence/live-preflight/); earlier P1/R2 evidence is unchanged. [Current configuration/setup instructions](CLOUD-SETUP.md).

## Working features and amendment

The existing Next.js/Payload application remains: authenticated admin at `/admin`, Pages, Posts, Media, Site Settings, REST/GraphQL APIs, published-only public content, local image variants, and SQLite persistence. Public registration and unauthorized writes are denied; editors cannot grant themselves administrator privileges. Local private originals/thumbnails remain protected.

Replaced GCS with official **`@payloadcms/storage-s3@3.93.0`**, aligned with all Payload packages. R2 uses region `auto`, path-style S3 operations, explicit server credentials and a separate delivery origin. Direct browser uploads are disabled. Remote configuration fails closed; preview/production cannot fall back to SQLite or disk. No Workers or separate media database.

**R2.dev exposes the entire bucket.** This integration accepts only explicitly public editorial media remotely; private/default uploads and public-to-private changes are rejected before the storage upload hook. Local private/public behavior is unchanged. A prefix is not an isolation boundary. Private cloud media needs a separately designed private bucket/delivery path.

Exact core stack retained: Node **22.23.5**, npm **11.19.0**, Next / eslint-config-next **16.4.3**, React / React DOM **19.2.4**, Payload / Next integration / SQLite / Lexical / S3 adapters **3.93.0**, libSQL client **0.14.0**, GraphQL **16.15.0**, Sharp **0.35.5**, TypeScript **5.9.3**, Tailwind **3.4.19**, Playwright **1.59.1**, tsx **4.23.15**. AWS client-s3/lib-storage/s3-request-presigner resolve to **3.1169.0** in the lockfile. All direct versions are exact; clean `npm ci` reproduces the installation. [Payload storage contract](https://payloadcms.com/docs/upload/storage-adapters).

## New local regression evidence

All amendment evidence is in [evidence/r2-001](../evidence/r2-001/). P1 evidence remains separate and unchanged; its previous report is [archived](archive/MISSION-001-before-r2.md).

Commands run at repository root. This host uses `export PATH=/tmp/stark-node-runtime/node_modules/.bin:$PATH` and `export PLAYWRIGHT_BROWSERS_PATH=/tmp/stark-playwright`; ordinary installations can use `.nvmrc` and Playwright's default browser location.

| Command | Actual result | Evidence in `evidence/r2-001/` |
| --- | --- | --- |
| `npm install --cache /tmp/stark-npm-cache --fetch-retries=0` | PASS, adapter replacement and lockfile update | `install.log` |
| `npm ci --cache /tmp/stark-npm-cache --fetch-retries=0` | PASS, 741 packages installed from updated lockfile | `ci.log` |
| `npm ls --all` | PASS, no invalid/missing dependencies | `dependency-tree.log` |
| `npm audit --json --cache /tmp/stark-npm-cache` | **FAIL**, exit 1: 1 critical, 0 high, 12 moderate, 10 low | `audit.json` |
| `npm run typecheck` | PASS | `typecheck.log` |
| `npm run lint` | PASS, zero warnings | `lint.log` |
| `npm run test:unit` | PASS, six tests: environment, R2 visibility/keys/URLs, retained dependency compatibility | `unit.log` |
| `npm run generate:importmap`; `npm run check:generated` | PASS, regenerated types and import map consistent | `generated.log` |
| `node --import tsx scripts/check-storage-schema.ts` | PASS, local/R2 persisted fields identical; remote local-byte persistence disabled; no signed-upload endpoint; no network operation | `storage-schema.log` |
| `npm run build` | PASS, optimized production build | `build.log` |
| `npm run verify:local` | PASS, clean SQLite migration, CLI bootstrap, Chromium/admin/API checks, fresh-process restart, repeat migration/status | `verify-local.log`, `local-proof.json` |
| `node --import tsx scripts/smoke-dev.ts` | PASS, disposable local development HTTP smoke, loopback only | `dev-smoke.log`, `dev-server.log` |
| `node scripts/inspect-monaco.mjs` | Completed build/trace/vendor inspection; **not a vulnerability remediation PASS** | `monaco-bundle.json` |
| `git diff --check` | PASS | `repository-checks.json` |
| Live Turso / R2 upload, object existence and delivery | **BLOCKED**, approved targets and credentials absent | No remote result claimed |

Retained failures: initial import-map consistency failed because the GCS entry needed replacement; regenerated using Payload and rechecked. An initial browser run overlapped two logins against one test administrator; CMS suites now run serially and the isolated rerun passed. The Monaco probe records the actual hidden-route 404 rather than assuming editor reachability. Logs marked `initial` retain those failures.

Lint retains P1's narrow CommonJS exception for historical `QAM/evidence/**/*.cjs`; no historical scripts were modified or deleted and no new lint suppression was added.

## Browser, access and persistence proof

Real Chromium ran an empty-database registration-denial test, four main tests (desktop CMS, Monaco observation, desktop/mobile homepage), and one fresh-server restart test. Four main-suite skips are intentional phase/project filters, not claimed coverage. CMS mobile editing is not tested.

Browser clicks covered admin login, Page creation/publishing, real Media multipart upload/save, saved Post/featured-image display and public rendering. Authenticated REST created Posts/drafts, updated settings and created an editor. REST/GraphQL also checked denied anonymous writes/user access, draft/version filtering, private media protection, MIME/size rejection, key tamper protection and failed editor privilege escalation. Those REST actions are not mislabeled as browser clicks. CMS traces, screenshots and page snapshots remain disabled to protect credentials.

After stopping the app and starting a new process, the disposable database retained **2 users, 3 pages, 2 posts, 1 media record, 1 settings record and 1 applied migration**; session count and database identifier are in [local-proof.json](../evidence/r2-001/local-proof.json). Original image bytes decoded at width 800 after restart; the earlier thumbnail read decoded at width 400. The Post image relationship and Site Settings survived. Reapplying migration was a no-op.

Actual tables: `users`, `users_sessions`, `pages`, `_pages_v`, `posts`, `_posts_v`, `media`, `site_settings`, `payload_kv`, `payload_locked_documents`, `payload_locked_documents_rels`, `payload_preferences`, `payload_preferences_rels`, `payload_migrations`. No new schema migration is needed for the storage adapter switch; local/R2 fields match and the existing migration/types are unchanged. Media stores metadata/relationships, not image BLOBs.

## Critical security assessment

**Unresolved; release hold.** Monaco **0.57.0** both depends on and embeds DOMPurify **3.4.15**. Critical [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7) is patched in DOMPurify 3.4.17, but a dependency override does not replace Monaco's vendored implementation. No fixed stable Monaco release was found; development prereleases were not installed.

Current build inspection found the lazy CDN loader but no DOMPurify implementation markers or server trace entries. Actual tested admin workflows did not load Monaco; the hidden preferences creation route returned 404. The inspected sanitizer wrapper does not enable the critical advisory's template/in-place modes. No active exploit path was demonstrated; these are bounded observations, not proof of universal safety.

The loader also targets a different Monaco version, **0.55.1**, whose npm artifact embeds DOMPurify **3.2.7**. Therefore future remediation must verify the actual browser-loaded code as well as the installed package. No cosmetic audit fix, third-party patch or postinstall rewrite was applied. Happy DOM's prior scoped fix remains. [Full assessment, advisories and closure requirements](DEPENDENCY-SECURITY.md).

## Director setup and next live test

Use the [exact cloud setup and verification procedure](CLOUD-SETUP.md). Smallest required setup:

1. Approve an empty disposable Turso database and a dedicated R2 bucket containing **only public editorial images**. Enable its temporary Public Development URL intentionally.
2. Install a database-scoped Turso token and an R2 **Object Read & Write** token scoped only to that bucket in an ignored environment file/secret manager. Never send keys in chat.
3. Set Turso variables: `APP_ENV=test`, `DATABASE_KIND=turso`, `DATABASE_URL`, matching `DATABASE_TARGET_HOST`, `DATABASE_AUTH_TOKEN`, stable `PAYLOAD_SECRET`.
4. Set storage variables: `MEDIA_STORAGE=r2`, `R2_BUCKET`, matching `R2_TARGET_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`, `R2_PREFIX`. Use the dashboard's S3 API origin separately from the r2.dev delivery origin. `MEDIA_PREFIX` is local-only.
5. Review/apply the migration with `MIGRATION_TARGET_HOST`; bootstrap the first admin with `BOOTSTRAP_TARGET_HOST` and hidden terminal password entry. Start on loopback; prove rejected private uploads, real public upload/thumbnail objects, direct delivery, Turso metadata/relationships and persistence after restart. Test replacement/deletion only on disposable fixtures.

No upload CORS is needed for the current server-mediated path. Optional GET/HEAD CORS for crop/canvas tools is documented with a narrow origin. Signed direct browser uploads are not enabled. The 3 MiB limit is below Vercel's 4.5 MB body ceiling but deployed upload behavior and production caching remain unverified; r2.dev is temporary development delivery.

Local demo: [README](../README.md) gives Node/install/migration setup, hidden-password admin creation, `npm run dev`, `/admin`, image/Post creation, and restart checks. Existing `.env` was preserved. Local images can remain private; remote public visibility must be selected before saving.

## Git and changed-file inventory

Branch remains **`feat/p1-payload-turso-gcs-poc`**; HEAD remains **`7715f6de3850e210b5b52a5049a6f1144a50c04c`**. Working tree intentionally contains the prior uncommitted foundation plus this amendment. No new branch or commit.

R2 changes: package manifest/lockfile; `payload.config.ts`; `cms/environment.ts`, `cms/collections.ts`, new `cms/r2.ts`; generated admin import map; environment/R2 tests and Monaco browser probe; Playwright serialization; schema inspection, evidence-output paths and Monaco inspection script; `.env.example`; README/cloud/security/handoff docs and archived earlier reports. [Amendment file inventory](../evidence/r2-001/changed-files.json) distinguishes these from the existing foundation; [full Git status](../evidence/r2-001/git-status.txt) shows the complete uncommitted checkout. [Repository checks](../evidence/r2-001/repository-checks.json) record preserved evidence/schema/types and ignore/secret checks.

Only live cloud proof and the unresolved security release hold remain. Public blog expansion, preview/publish/cache revalidation and a WordPress sample import can use this foundation next; none was added in this amendment.
