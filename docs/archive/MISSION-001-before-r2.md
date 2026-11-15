# Operation Turso — Mission 001 engineering handoff

**LOCAL FOUNDATION VERIFIED — REMOTE TURSO / GCS PENDING.** Engineering self-checks only; no independent QA or production certification. No commit, push, merge, provisioning, DNS change, or deployment.

## A. Exact working features and stack

- Existing responsive Next.js homepage/navigation preserved, moved into `app/(frontend)` so Payload owns its separate root layout.
- Real Payload `/admin`, REST `/api/*`, and GraphQL `/api/graphql` integration using the official blank-template routing pattern.
- CLI-only initial administrator setup; public registration denied even on an empty database. Payload password hashing and persistent sessions. Admins manage users/deletions; editors edit content, settings and images but cannot promote themselves or create users.
- Pages and Posts with unique validated slugs, Lexical content, drafts/published status and SEO fields. Posts additionally have excerpt, featured image and publish date.
- Media with real local bytes, metadata, alt/caption, visibility, stable key, MIME/size restrictions and a thumbnail. Site Settings persist name/description/logo.
- `/content` and `/content/{pages|posts}/{slug}` display published content using access-controlled Local API reads. No public draft access.
- Configuration-ready Turso and GCS adapters with explicit environment/target guards, no silent cloud/local fallback. Live cloud behavior is **not verified**.

Exact core versions: **Node 22.23.5**, npm 11.19.0; **Next / eslint-config-next 16.4.3**, **React / React DOM 19.2.4**, **all five direct Payload packages 3.93.0** (`payload`, `@payloadcms/next`, `@payloadcms/db-sqlite`, `@payloadcms/richtext-lexical`, `@payloadcms/storage-gcs`); **libSQL client 0.14.0**, **GraphQL 16.15.0**, **Sharp 0.35.5**, **TypeScript 5.9.3**, **Tailwind 3.4.19**, **Playwright 1.59.1**, **tsx 4.23.15**. All direct versions match manifest, lockfile and installation: [version evidence](../evidence/p1/direct-versions.json).

Retained the starter's compatible Next/React pins. Payload's registry peer range accepts Next 16.4.3 and its Lexical peers accept React 19.2.4; all Payload packages use the same release. Node 22.23.5 satisfies both current documentation and package engines. The host's original Node 26.7.0 did not satisfy the stricter current documentation, so checks used an isolated `/tmp/stark-node-runtime` installation. No system runtime was replaced.

References inspected: [Payload installation](https://payloadcms.com/docs/getting-started/installation), [SQLite](https://payloadcms.com/docs/database/sqlite), [Turso guide](https://payloadcms.com/posts/guides/how-to-set-up-payload-with-sqlite-and-turso-for-deployment-on-vercel), [storage](https://payloadcms.com/docs/upload/storage-adapters), [migrations](https://payloadcms.com/docs/database/migrations), and the pinned [official template](https://github.com/payloadcms/payload/tree/v3.93.0/templates/blank/src/app).

Ready next: build out the public blog and featured-image layout; add deliberate preview/publish/revalidation behavior; investigate one WordPress sample import. None of those larger features was implemented today.

## B. Commands and actual results

Commands ran at repository root with `PATH=/tmp/stark-node-runtime/node_modules/.bin:$PATH`. Browser commands additionally used `PLAYWRIGHT_BROWSERS_PATH=/tmp/stark-playwright`. Logs are under `evidence/p1/`.

| Command | Result | Evidence |
| --- | --- | --- |
| `npm install --cache /tmp/stark-npm-cache --fetch-retries=0` | PASS, initial dependency install; two subsequent bounded security-resolution installs | `install.log`, `security-install.log`, `security-install-final.log` |
| `npm ci --cache /tmp/stark-npm-cache --fetch-retries=0` | PASS, 773 packages installed from lockfile | `ci.log` |
| `npm ls --all` | PASS, no invalid/missing dependency errors | `dependency-tree.log` |
| `npm audit --json --cache /tmp/stark-npm-cache` | **FAIL/security findings**, exit 1: 1 critical, 0 high, 18 moderate, 9 low | `audit.json` |
| `npm run typecheck` | PASS | `typecheck.log` |
| `npm run lint` | PASS, zero warnings | `lint.log` |
| `npm run build` | PASS, real optimized Turbopack production build | `build.log` |
| `npm run generate:types` / `npm run generate:importmap` | PASS | Followed by consistency check below |
| `npm run check:generated` | PASS, regenerated artifacts have identical SHA-256 hashes | `generated.log` |
| `npm run test:unit` | PASS, both environment/security test files | `unit.log` |
| `node --import tsx scripts/check-storage-schema.ts` | PASS, local/GCS persisted field structures match; no cloud operation | `storage-schema.log` |
| `npm run payload -- migrate:create foundation` | PASS, official generated migration/snapshot | `migrations/20261114_040213_foundation.{ts,json}` |
| `npm run db:migrate` | PASS on local database | `local-migrate.log` |
| `node node_modules/playwright/cli.js install chromium` | PASS, Chromium 147.0.7727.15 / revision 1217 | `browser-install.log` |
| `npm run verify:local` | PASS: fresh migration, bootstrap browser test, CLI admin creation, CMS/browser/API checks, fresh-server restart, repeat migration/status | `verify-local.log`, `local-proof.json` |
| `node --import tsx scripts/smoke-dev.ts` | PASS, disposable DB; development HTTP `/admin`, `/api/pages`, `/content` each 200, homepage readiness 200 | `dev-smoke.log`, `dev-server.log` |
| `git diff --check` | PASS | Final terminal check |

Initial failures were investigated and retained: inherited lint errors; a too-broad access-helper type; unused generated migration arguments; sandboxed build stall; and browser selectors that expected `Log in`, `Publish`, and image alt text where Payload displays `Login`, `Publish changes`, and filename. Final tests assert actual UI behavior and persisted data. Earlier logs are explicitly named `initial`, `second`, `third`, or `fourth`. No failed check is represented as a pass. See the security review for the discarded sanitizer-harness experiment.

## C. Vulnerabilities resolved and remaining

Happy DOM **20.14.6 → 21.0.4** is a narrowly scoped, reviewed override under `@lexical/headless@0.50.0`. The upstream security change disables CSS/iframe loading by default; this app needs neither. The focused test verifies the DOM APIs used by Lexical. High findings are eliminated from the installed tree.

**DOMPurify remains unresolved and blocks release.** Monaco 0.57.0 embeds vulnerable DOMPurify 3.4.15 as well as declaring it as a dependency. A trial npm override did not repair the embedded copy and was removed. No editor-facing Monaco field is configured here, and no exploit path was demonstrated, but this is not a waiver or a production safety claim.

[Dependency security review](DEPENDENCY-SECURITY.md) records exact chains, advisories, runtime/tooling distinctions, reachability limits, mitigations and remaining low/moderate findings. No `audit fix --force`, global dependency override, lockfile deletion, or report suppression was used.

## D. Lint disposition

The 13 original errors were valid CommonJS `require()` calls in three pre-existing `.cjs` QA tools. A narrow rule exception applies only to `QAM/evidence/**/*.cjs`; every other lint rule remains active. Archived QA files and behavior were preserved. New-code issues were fixed, including unused migration destructuring. Final lint passes with zero warnings.

## E. Local SQLite persistence and schema evidence

The final disposable database is identified in [local-proof.json](../evidence/p1/local-proof.json). After stopping the application and starting a new process, it contained **2 users, 3 sessions, 3 pages, 2 posts, 1 media record, 1 settings record and 1 migration record**. Counts include intentionally hidden drafts and an editor-created draft. Anonymous reads returned only published records. Image bytes were decoded after restart and retained their 800-pixel width; featured-image relationships and settings remained accessible.

The 14 actual tables are: `users`, `users_sessions`, `pages`, `_pages_v`, `posts`, `_posts_v`, `media`, `site_settings`, `payload_kv`, `payload_locked_documents`, `payload_locked_documents_rels`, `payload_preferences`, `payload_preferences_rels`, `payload_migrations`. [Schema inspection](../evidence/p1/schema.json) records real SQLite column names/types. Authentication uses hash/salt columns. Media stores filenames, keys, URLs, MIME, sizes and dimensions, not image BLOBs.

Schema push is disabled in every environment. The official generated migration applies to an empty file; a second application is a no-op and status reports batch 1 applied. No destructive migration was executed. SQLite transactions remain at the adapter default; failed migrations are not assumed atomic.

## F. Browser/admin evidence and manual demo

Real Chromium runs passed: **one empty-database bootstrap test; three main tests (desktop CMS plus desktop/mobile homepage); one restart test**. Three skips in the main run are intentional phase/project filters, not claimed coverage. CMS mobile editing is not tested.

Browser actions: admin page load/login, Page form with Lexical content and publishing, actual Media multipart upload/save, saved Post form and image relationship display, public content page, and login/content reads after restart. Authenticated REST creates the Post and test drafts, changes visibility/settings, and creates the editor; those actions are not mislabeled as browser clicks. REST/GraphQL also verify draft filtering, denied anonymous writes/user reads, protected private originals/thumbnails, MIME/size rejection, key tamper protection, and failed editor privilege escalation. Generated credentials are not printed; CMS traces/screenshots and automatic page snapshots are disabled. Homepage screenshots are in `evidence/p1/{desktop,mobile}.png`.

For Tony: follow [README setup](../README.md), run migrations, create the initial admin with hidden terminal password entry, run `npm run dev`, open `http://127.0.0.1:3001/admin`, create/upload/publish, then restart and revisit. Local `.env` already exists in this checkout with a generated secret; preserve it. `.data/local/payload.db` has schema but no seeded admin. Test accounts are confined to disposable test files and are not intended as reusable demo credentials.

## G. Turso requirements

**BLOCKED: no approved dedicated test target/token provided.** Required: `APP_ENV=test`, `DATABASE_KIND=turso`, `DATABASE_URL`, `DATABASE_TARGET_HOST`, `DATABASE_AUTH_TOKEN`, stable `PAYLOAD_SECRET`. The libSQL host must match the explicit target. Set `MIGRATION_TARGET_HOST` only after reviewing the approved target/migration, and `BOOTSTRAP_TARGET_HOST` for initial test admin setup.

Tony's smallest steps: approve one disposable database; place its scoped token privately; configure the matching hostname; run guarded migration/status and bootstrap; create/read records; restart and verify remote persistence. See [exact safe setup](CLOUD-SETUP.md). No production identifier or credentials are hardcoded.

## H. GCS requirements

**BLOCKED: no approved bucket/IAM/credentials provided.** Required: `MEDIA_STORAGE=gcs`, `GCS_BUCKET`, matching `GCS_TARGET_BUCKET`, `GCS_PROJECT_ID`, `MEDIA_PREFIX`, and ADC/workload identity or `GOOGLE_APPLICATION_CREDENTIALS` pointing outside Git. Use a dedicated private bucket with public-access prevention and verified bucket-scoped object permissions. Prefixes alone are not security boundaries.

Tony's smallest steps: approve the private test bucket and identity permissions; set configuration privately; upload through Payload; inspect actual GCS original/thumbnail objects; verify private/public delivery; repeat after restart with Turso selected. GCS is configured to disable local bytes and retain Payload access checks. Local/GCS schema equivalence passed, but actual GCS write/read is untested. Direct client uploads are disabled. The 3 MiB file limit is below Vercel's 4.5 MB request limit, but Vercel and large uploads remain unverified. Full instructions and official references: [cloud setup](CLOUD-SETUP.md).

## I. Exact remaining blockers

- Live Turso proof requires an approved disposable target and scoped credentials.
- Live GCS proof requires an approved private bucket and verified IAM/credentials. Full P1.1 also requires media metadata in Turso and cross-restart delivery from GCS.
- Production release is blocked by the unresolved bundled DOMPurify finding and the pending cloud/deployment validation. Lower-severity findings remain tracked.

There is no remaining blocker to the verified isolated local foundation. Email recovery, full blog UI, preview/revalidation, WordPress import and production operations remain outside this mission.

## J. Repository and changes

Root: `/home/moose/NEXTJS/NEXTJS_PAYLOAD_SQLITE_TEST/web-factory-nextjs-starter-v2-payload-cms`.

Branch: **`feat/p1-payload-turso-gcs-poc`**. HEAD remains **`7715f6de3850e210b5b52a5049a6f1144a50c04c`**. Initial `main` was clean, tracked `origin/main`, and matched the remote ref checked with `git ls-remote`. The repository was an existing useful starter, not empty. No other repository was modified.

Working tree intentionally contains uncommitted implementation changes: frontend route-group moves; Payload routes/config/generated files; collections/access/environment code; migration and snapshot; scripts/tests; pinned package manifest/lockfile; Next/TypeScript/ESLint/Playwright settings; `.env.example`, `.nvmrc`, ignore rules; README/docs and current evidence. Next dev also generated `AGENTS.md` with its own version-specific guidance; it was read and retained. `next-env.d.ts` is framework-generated. Historical `QAM/`, `agent_docs/`, shared components/content and public assets are unchanged.

No secret, database, WAL/SHM companion, or local media file is selected for Git. The `.env` and `.data/` ignore rules were verified. Final Git status is saved in `evidence/p1/git-status.txt`. No commit or push was authorized or performed.
