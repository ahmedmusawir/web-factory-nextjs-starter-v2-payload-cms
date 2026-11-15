# Stark Web Factory V2 — CMS-powered POC website

Next.js App Router with embedded Payload, authenticated editors, Pages, Posts, Media, and Site Settings. The seven-page Cyberize reference website now renders editable Payload content; its original components, CSS and fonts are preserved. `/content` lists published CMS content. One application/database/storage boundary per client; no multi-tenant system or WordPress importer.

## Start locally

This checkout currently selects the approved remote POC through `.env.local`, which overrides `.env`. Ordinary dev/CLI commands use that selected target. `npm run verify:local` supplies explicit disposable SQLite/local-media overrides; copying `.env.example` to `.env` alone does not override `.env.local`. Choose the environment deliberately before manual migration or editing.

Use Node **22.23.5** (`.nvmrc`), or another version satisfying `package.json`. All direct dependencies and the npm lockfile are pinned. In this engineering environment the temporary runtime is `/tmp/stark-node-runtime/node_modules/.bin`; prepend it to PATH if the system Node is older than the declared requirement.

```sh
nvm use
npm ci
cp .env.example .env  # only for a new checkout; preserve an existing .env
node --input-type=module -e 'import fs from "node:fs"; import crypto from "node:crypto"; const p=".env"; const s=fs.readFileSync(p,"utf8"); if (!/^PAYLOAD_SECRET=$/m.test(s)) throw Error("Existing secret preserved"); fs.writeFileSync(p,s.replace(/^PAYLOAD_SECRET=$/m,"PAYLOAD_SECRET="+crypto.randomBytes(32).toString("hex")),{mode:0o600}); fs.chmodSync(p,0o600)'
npm run db:migrate
```

Create the first administrator **in your terminal**, using your own unique password (at least 16 characters). Password entry is hidden and does not enter shell history. Never send credentials in chat.

```sh
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Unique admin password (16+ characters): ' ADMIN_PASSWORD
export ADMIN_EMAIL ADMIN_PASSWORD
npm run admin:create
unset ADMIN_EMAIL ADMIN_PASSWORD
npm run dev
```

The setup command refuses to bootstrap once any user exists. Public registration, including Payload's empty-database first-register endpoint, is blocked. Existing admins create editors through Users. Editors can edit content/settings/media and read their own user record; only admins manage users and delete content. Password recovery email is deliberately disabled until a real mail adapter is configured; no reset links are logged.

Open **http://127.0.0.1:3001/admin** and log in. All server scripts bind to loopback. Check port 3001 is free before starting; never stop another service or use the old project's ports. Stop your own server with Ctrl+C.

## Mission 003: blog and 30-second ISR

`/blog` and `/blog/[slug]` now serve 12 full WordPress articles from Payload/Turso with R2 featured and inline images. Public website/blog/content routes use request-driven 30-second ISR. Publication invalidates affected paths; authenticated previews and admin/API routes remain dynamic. Settings/media updates invalidate the public layout. No rebuild is needed for ordinary publication.

See [Mission 003 handoff](docs/MISSION-003-HANDOFF.md) for cache measurements, article URLs, regression evidence and container limitations. The critical Monaco/DOMPurify release block remains.

The existing port-3001 process was preserved during engineering. After stopping it yourself, use `NEXT_DIST_DIR=.next-mission003 npm start` for the verified build, or perform a standard `npm run build && npm start`. Never reuse an ISR build across different database/client targets. `verify:local` builds against its own disposable SQLite database; `TEST_PORT=3004 npm run verify:local` leaves port 3001 free.

Container-only builds use `BUILD_STANDALONE=1`; the Dockerfile sets it automatically. Docker/Cloud Run configuration is prepared for review, with no deployment performed.

## Mission 002 website workflow

The approved Turso database now holds the actual reference website, and its twelve editorial images live in R2 under `R2_PREFIX/web-factory-poc-site-1`. Do not reset the database or run the old empty-database Mission 001 remote verifier against this content.

Open `/`, `/seo-services/`, `/ppc/`, `/website-design/`, `/web-development/`, `/website-support/`, and `/contact/`. In Payload, open **Pages → Home → Website sections → Show All → Hero heading**. Save Draft leaves the public page unchanged; Preview opens an authenticated `/preview/home` view. Publish changes, then refresh the public page after regeneration: no rebuild is required. Edit shared navigation/footer/contact content in Site Settings.

To replace an existing editorial image, open its Media record, remove the selected file in the form, choose a new JPEG/PNG/WebP, retain **public** visibility, and Save. This preserves the relationship and website storage prefix. R2 images are public immediately; media replacement itself has no draft stage. To stage a different image with a page draft, upload a public media record, select it in the section’s Image field, then Save Draft or Publish.

`npm run site:import` is an operator-only idempotent import from the read-only sibling reference. Existing imported records are always skipped, including editor changes; unrelated slug/settings collisions stop the import. It does not migrate. `npm run verify:local` automatically imports the site into its disposable SQLite database.

See [Mission 002 handoff and evidence](docs/MISSION-002-HANDOFF.md) for current results, visual differences and exact reproduction steps.

## Foundation collections demonstration

1. Log in at `/admin`; create a Page with title, lowercase hyphenated slug, and rich-text content. Use Publish to make it public, or save a draft.
2. Under Media, create an upload using a real JPEG, PNG, or WebP, at most **3 MiB**. Add alt text and caption. In remote mode select **public before saving**; private cloud uploads are rejected. Private records and bytes require an authorized editor. A 400×300 thumbnail is generated when the source is large enough.
3. Create a Post, add excerpt, content, publish date and SEO text; select the uploaded featured image. Publish it.
4. Set the website name/description and optional logo under Site Settings. Public logos must use public media.
5. Open `/content` and `/content/posts/your-slug` in a signed-out browser. Draft pages/posts should not appear. The minimal detail view renders rich text; a complete blog/featured-image layout remains next-mission work.
6. Stop your server, restart with `npm run dev`, and log in again. Confirm the records, featured-image relationship, settings, and image URLs still work.

Local bytes live under `.data/local/media`, outside `public/`, and are delivered through Payload access checks. SQLite stores metadata/relationships, not image BLOBs. Keep `.data/local/payload.db`, media files, and `.env` together for local continuity. Do not change the secret or database path between restarts.

## Engineering checks

```sh
npm run generate:types
npm run generate:importmap
npm run check:generated
npm run lint
npm run typecheck
npm run test:unit
node --import tsx scripts/check-storage-schema.ts
npm run build
npx playwright install chromium
npm run verify:local
```

`verify:local` creates a new `.data/test/<random-id>.db` and unpredictable credentials in child-process environments. It applies real migrations, proves public bootstrap is denied, creates an admin through the CLI, runs Chromium desktop CMS tests plus desktop/mobile homepage tests, stops the server, starts a fresh server, checks persistence, and reapplies migrations to prove they are a no-op. It never targets Turso or R2. The CMS tests disable traces/screenshots and automatic page snapshots to keep credentials out of artifacts. Test image files use random names in `.data/test/media`. Disposable files are retained locally for inspection and ignored by Git. Do not run tests concurrently with another service on port 3001.

This host uses `PLAYWRIGHT_BROWSERS_PATH=/tmp/stark-playwright` for its installed browser; ordinary installations can use Playwright's default path. Chromium uses Playwright's Ubuntu fallback on this host.

A production-mode **loopback** preview is `npm run build && npm run start`; it uses the explicitly selected environment, currently the remote POC. Build does not migrate or provision anything.

## R2 amendment

`@payloadcms/storage-s3@3.93.0` now supplies the Cloudflare R2 integration. Local mode still needs no cloud credentials and supports private/public images. Remote mode requires Turso plus R2; missing settings fail startup. The API endpoint and delivery URL are separate.

**R2.dev exposes the entire bucket.** Use a dedicated bucket containing only intentionally public editorial images. R2 uploads require explicitly selecting **public** before saving; private uploads and changing public records to private are rejected. Private cloud media requires a future separate private storage design. Direct browser uploads are disabled. No Cloudflare Workers or separate media database is used.

Required remote storage variables: `R2_BUCKET`, `R2_TARGET_BUCKET` (same approved bucket), `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`, `R2_PREFIX`. `MEDIA_PREFIX` remains local-only. R2.dev is temporary, rate-limited POC delivery, with no production CDN-cache claim.

Mission 001 Turso/R2 engineering verification **passed** on the approved disposable targets: browser upload, public delivery, Turso metadata, restart persistence and cleanup. Results are in `evidence/live-integration/`; earlier `evidence/p1/`, `evidence/r2-001/` and preflight evidence are preserved. The test administrator and fixtures were removed; create your own admin securely for manual QA. The critical Monaco/DOMPurify dependency remains unresolved and blocks production release. See the handoff for failures, evidence and limits.

## Database and storage configuration

See [cloud setup and environment boundaries](docs/CLOUD-SETUP.md). Local mode needs no cloud credentials. Remote testing uses the separately approved disposable Turso target and dedicated public-editorial R2 bucket with scoped API credentials from `.env.local`. No cloud resources have been provisioned and no deployment is configured.

Automatic Drizzle schema push is disabled. `npm run db:migrate` applies only pending generated migrations; `npm run db:status` reports them. After schema edits, run `npm run payload -- migrate:create descriptive-name`, review the generated SQL/snapshot, and test on a fresh disposable database. SQLite migrations are not assumed to roll back atomically; back up any non-disposable target first. The wrapper excludes reset/fresh/down commands. Never use raw destructive Payload commands against external data.

Keep the generated migration, types, import map, manifest and lockfile in a future reviewed commit. No commit or push has been made by this mission. Historical `QAM/` evidence and `agent_docs/` reports concern the previous starter; they are preserved and do not certify this foundation.

[Engineering handoff](docs/MISSION-001-HANDOFF.md) · [Dependency security review](docs/DEPENDENCY-SECURITY.md)
