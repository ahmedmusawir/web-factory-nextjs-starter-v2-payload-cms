# Mission 001 — live Turso / R2 engineering handoff

**REMOTE INTEGRATION ENGINEERING VERIFIED — READY FOR INDEPENDENT QA.** This is an engineering result, not QA certification or production readiness. Monaco/DOMPurify remains a production-release blocker. No commit, push, merge, deployment, cloud provisioning or database reset occurred.

## Results

| Area | Outcome | Evidence |
| --- | --- | --- |
| Configuration and target guards | **PASS** — `APP_ENV=test`, `DATABASE_KIND=turso`, `MEDIA_STORAGE=r2`; database, migration/bootstrap hostname confirmations and bucket confirmation agree; credentials present without disclosure | [Preflight](../evidence/live-integration/preflight.json) |
| Turso | **PASS** — connected only to `web-factory-v2-poc-db`; initially empty; applied the reviewed initial migration; real Payload CRUD persisted | [Initial inspection](../evidence/live-integration/initial-remote-inspection.json), [schema](../evidence/live-integration/migrated-schema.json) |
| Cloudflare R2 | **PASS** — used only `stark-web-factory-poc-media`; real original/thumbnail uploads, authenticated object reads and public r2.dev delivery | [Successful workflow](../evidence/live-integration/5576c364-aa38-45bd-b4c1-1855f1da1e8b/results.json) |
| Browser | **PASS** — actual Chromium admin login, Page creation/publication, public Media upload, Post/image display, and public content rendering | Same workflow; no credential-bearing screenshots, traces or saved browser state |
| Restart persistence | **PASS** — new application process; browser login, content, settings, image relationship and identical R2 bytes remained accessible | `imagesAfterRestart` and workflow stages |
| Access controls | **PASS** — public first-register denied on empty DB; anonymous writes/user reads denied; drafts hidden; private R2 upload and public-to-private change rejected | Workflow stages; local regression additionally checks editor privilege escalation |
| Cleanup | **PASS** — removed only generated test content/media/admin; bucket empty; Site Settings restored to defaults | [Separate final read-only inspection](../evidence/live-integration/final-remote-state.json) |

Preflight was rerun after the Director corrected `.env.local`. It remains Git-ignored, mode `600`, and was not edited by engineering. API tokens, secret keys, Payload secret and temporary passwords were never printed or written into evidence. The CLI loader uses `@next/env@16.4.3`; shell overrides still isolate local tests from the remote file.

## Migration and persistence proof

The exact `20261114_040213_foundation` migration was unchanged from the local proof (SHA-256 in preflight evidence). Its `up` contains **70 CREATE TABLE/INDEX statements**, with no destructive DDL/DML. Only `up` ran, once, against the verified empty database. The migration record is batch 1; `down`, reset and fresh commands were not used.

The 14 tables are `users`, `users_sessions`, `pages`, `_pages_v`, `posts`, `_posts_v`, `media`, `site_settings`, `payload_kv`, `payload_locked_documents`, `payload_locked_documents_rels`, `payload_preferences`, `payload_preferences_rels`, `payload_migrations`.

Before restart, Turso contained **1 temporary admin, 2 Pages, 2 Posts, 1 Media record and 1 Site Settings record**, including hidden drafts. A Page's updated SEO value, published Post, featured-image relationship and settings survived the process restart.

The real PNG original was **800×600, 8,593 bytes**; its thumbnail was **400×300, 2,476 bytes**. Both objects existed under the configured prefix, and their public HTTP 200 responses matched authenticated R2 object SHA-256 hashes before and after restart. Media key, filename, MIME and dimensions were independently selected from Turso. Local media directory contents did not change during the remote run.

Final read-only counts: **zero users, sessions, Pages/Posts and their versions, Media, preferences or locks; one migration record and one restored Site Settings record**. The entire approved bucket is empty. Settings are `Stark Web Factory`, null description and null logo. Test credentials were memory-only and the generated administrator was deleted; no reusable test login was left behind.

## Commands and regressions

Commands ran from this repository with Node **22.23.5** and npm **11.19.0** using `export PATH=/tmp/stark-node-runtime/node_modules/.bin:$PATH`. Browser runs also used `export PLAYWRIGHT_BROWSERS_PATH=/tmp/stark-playwright` on this host. Core pins remain Next **16.4.3**, React **19.2.4**, Payload packages including SQLite/S3 **3.93.0**. Manifest and lockfile remain exact.

| Command / operation | Result | Evidence under `evidence/live-integration/` |
| --- | --- | --- |
| Secret-free environment validation, migration review and read-only Turso/R2 inspection | PASS | `preflight.json`, `initial-remote-inspection.json` |
| `node --import tsx scripts/payload-cli.ts migrate` through guarded operator wrapper | PASS, initial migration only | `migration.log`, `migrated-schema.json` |
| `node --import tsx scripts/verify-remote.ts --approved-live-poc` | PASS, final complete run including authenticated cleanup | `workflow.log`, successful run directory above |
| `npm run build` | PASS, production build with remote configuration, no deployment | `build.log` |
| `npm run typecheck` | PASS | `typecheck.log` |
| `npm run lint` | PASS, zero warnings | `lint.log` |
| `npm run test:unit` | PASS, seven tests | `unit.log` |
| `npm run generate:types`; `npm run check:generated` | PASS, generated types/import map consistency | `generate-types.log`, `generated.log` |
| `node --import tsx scripts/check-storage-schema.ts` | PASS, isolated local/R2 schemas match; no remote requests | `storage-schema.log` |
| `ENGINEERING_EVIDENCE_DIR=evidence/live-integration/local-regression npm run verify:local` | PASS, new disposable SQLite migration, browser/API controls, restart persistence and repeat migration | `local-regression/` |
| `npm audit --json --cache /tmp/stark-npm-cache` | **FAIL/security findings**, 1 critical, 0 high, 12 moderate, 10 low | `audit.json` |
| Final remote SELECT counts and bounded bucket listing | PASS, read-only cleanup verification | `final-remote-state.json` |
| `git diff --check`, prior-evidence hashes and secret/ignore checks | PASS | `repository-checks.json` |

The local browser suite has six executed tests across bootstrap, main and restart phases; four main-phase skips are intentional project/phase filters. Browser actions and REST actions are distinguished: Pages and Media were created with actual UI controls; Post/draft/settings mutations used authenticated Payload REST, followed by browser and SQL/read verification. CMS editing on mobile, deployment and large-file uploads are not claimed.

## Failures investigated, not hidden

- The first live run hit a transient libSQL read failure after bootstrap. The harness had not yet captured the admin ID and initially reported cleanup incorrectly. A guarded operator cleanup verified the exact run identity and creation window, then deleted only that orphan test administrator. The original report retains the correction explicitly. Cleanup now recovers the authenticated run identity and verifies zero users; read-only SELECTs retry at most three attempts. Writes are not automatically retried.
- The second run checked R2 before the asynchronous Media save had finished and received `NoSuchKey`. Its fixtures were cleaned. The harness now waits for the completed **HTTP 201 upload response**, then checks objects and bytes. The third complete run passed. Initial logs and per-run reports remain available.
- Switching configuration modes exposed generated-type differences limited to a description and field order. The Media description/order is now consistent between modes, with unchanged fields/access logic/schema. Schema inspection also explicitly isolates its local fixture configuration from `.env.local`. No additional migration was required.

The successful run still used one read-only retry. This bounded POC does not establish production availability or write-retry semantics.

## Security and remaining scope

**Monaco/DOMPurify remains unresolved and blocks production release.** Installed Monaco **0.57.0** embeds vulnerable DOMPurify **3.4.15**; an override of the declared dependency would not fix the vendored copy. The lazy loader also references a different CDN editor version. No new suppression, unsupported override or bundle patch was introduced. [Full security assessment](DEPENDENCY-SECURITY.md).

Remote tests confirmed operations on the authorized bucket, not the scope of the Cloudflare account policy across other resources. No other bucket/database was probed. Private cloud files, signed direct-browser uploads, production caching/CDN, email recovery, preview/revalidation, a complete blog UI and WordPress migration remain outside this proof. R2.dev is development delivery; current uploads go through Payload and are limited to 3 MiB images.

There is **no remaining blocker to independent QA of this bounded integration**. The security release hold and untested production/deployment concerns remain. QA should use the existing approved targets and its own secure CLI-created administrator; do not send credentials in chat.

## Runbook and repository

[Cloud setup](CLOUD-SETUP.md) lists all variables, bucket permissions and optional read CORS. With the approved `.env.local`, use the README's hidden terminal password-entry method and `npm run admin:create`, then `npm run dev` on `http://127.0.0.1:3001/admin`. The database schema is already applied. The automated live verifier deliberately refuses existing users/content or non-empty test-prefix storage; do not reset resources to bypass that check.

Branch remains **`feat/p1-payload-turso-gcs-poc`**; HEAD remains **`7715f6de3850e210b5b52a5049a6f1144a50c04c`**. Changes are uncommitted. This resume adds the bounded live verifier, separate local evidence output paths, stable Media type metadata/order, isolated schema inspection, regenerated types and documentation/evidence. No authentication or storage write permission was weakened. [Full Git status](../evidence/live-integration/git-status.txt), [resume inventory](../evidence/live-integration/changed-files.json).

Earlier P1, R2 and preflight evidence remain byte-for-byte preserved. [Previous handoff](archive/MISSION-001-before-live.md) records the earlier pending/blocked states; this report supersedes those statuses.
