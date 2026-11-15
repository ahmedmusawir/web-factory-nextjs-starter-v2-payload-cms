# Mission 002 — real website integration

Engineering work on the approved disposable POC only. **Production release remains blocked by Monaco/DOMPurify.** No deployment or independent QA certification.

## Preservation and reference inventory

Started on `feat/p1-payload-turso-gcs-poc`, HEAD `7715f6de3850e210b5b52a5049a6f1144a50c04c`. Mission 001 was uncommitted; it was preserved before edits. [Checkpoint](../evidence/mission-002/checkpoint.json), [baseline hashes](../evidence/mission-002/checkpoint-hashes.json), and [initial status](../evidence/mission-002/checkpoint-git-status.txt) identify the exact starting state. A secret-free source checkpoint is retained locally at `.data/checkpoints/mission-001/`; original evidence remains in place.

The read-only sibling `web-factory-poc-site-1` is the design/content authority. Its actual stack matches Next **16.4.3**, React **19.2.4**. No new dependency was needed; Payload and adapters remain **3.93.0**. [Reference inventory](../evidence/mission-002/reference-inventory.json) and [source hashes](../evidence/mission-002/reference-hashes.json) cover the inspected source.

| Public route | Fixed page sections |
| --- | --- |
| `/` | Agency hero, solutions, traffic, closing CTA |
| `/seo-services/` | Original SEO service sections and CTA |
| `/ppc/` | Original seven PPC sections |
| `/website-design/` | Original design sections, five FAQ details, CTA |
| `/web-development/` | Original development sections and CTA |
| `/website-support/` | Original support sections and CTA |
| `/contact/` | Conversation/contact and starting points |

There are 32 page sections plus shared header/footer, with 496 original content values. Reused: seven page JSX templates, Header, Footer, Artwork fallback, exact global CSS, Bricolage Grotesque/Manrope font files and licenses. Mobile navigation, Services dropdown, Escape/focus behavior, anchors, native FAQ details and responsive breakpoints remain. There is no reference contact form; provisional phone/address notices are preserved. Decorative CSS diagrams/icons and layout remain source code. Twelve editorial assets (eleven original SVG illustrations and one PNG logo) become Payload media. No reference `.git`, environment, credentials or repository mutations were used.

## Payload implementation and migrations

`cms/website-fields.ts` defines fixed section keys with conditional, typed text/textarea/upload fields. Editors change headings, paragraphs, CTA labels/URLs, alt text and media relationships. This is not a generic page builder or JSON editor. Existing Pages rich text, Posts, Users, Media and access controls remain.

Pages add template, structured sections, stable source ID/digest, and reuse SEO/status/version fields. Site Settings add shared header/footer sections, contact fields and the provisional-contact switch. Media adds import identity/digest. The renderer uses stored content; missing editorial fields have no hardcoded fixture fallback. Import fixtures live only under `scripts/fixtures/`.

Official generated migration `20261114_072417_website` adds 29 CREATE/ADD statements: `pages_sections`, `_pages_v_version_sections`, `site_settings_sections`, indexes and nullable fields. Its `up` contains no data deletion or table rebuild. Existing foundation migration is unchanged. Both migrations pass on clean SQLite; the remote migration is batch 2. [Remote schema/count evidence](../evidence/mission-002/remote-migration.json).

The migration wrapper's first lexical safety check incorrectly matched foreign-key `ON DELETE`/`ON UPDATE` clauses and stopped before writes. It was corrected to check statement types against the reviewed hash. The subsequent migration completed, but a post-migration read lost its connection. A separate read-only inspection confirmed completion and preserved counts; the migration was **not rerun**.

## Import and R2

`npm run site:import` uses Payload Local API, guarded to the approved POC target in remote mode. It preserves slugs, source section order, SEO, text and media relationships. Stable IDs use `web-factory-poc-site-1:page:*`, `:media:*`, and `:settings`. Existing imported records are skipped, including editor changes; unrelated page/settings collisions stop before writes. This is a one-site operator importer, not a WordPress engine.

Initial remote import: **20 created** (7 pages, 12 media, 1 global update), no conflicts. [Import results](../evidence/mission-002/remote-import/import-result.json). The approved database is `web-factory-v2-poc-db`; the approved bucket is `stark-web-factory-poc-media`; website objects use `R2_PREFIX/web-factory-poc-site-1/`. Imported originals and thumbnails have metadata/relationships in Turso, bytes in R2, and public URLs from `R2_PUBLIC_URL`.

SVG illustrations are rasterized to PNG through Sharp, then uploaded through Payload. This retains the existing JPEG/PNG/WebP security boundary instead of enabling SVG uploads. Initial 1600px conversion rounded intrinsic heights and introduced subpixel layout shifts; correction verifies the source digest and our initial bytes before replacing them at exact 1200px source dimensions. IDs and relationships remain intact. [Correction evidence](../evidence/mission-002/aspect-correction.json). SVG/PNG rasterization differences remain possible; no pixel-perfect claim.

Existing media replacement preserves its stored prefix. Generic new Media records still use the configured base `R2_PREFIX`; imported website assets and file replacements remain under the dedicated website namespace. R2 storage is public editorial only; changing a database visibility field cannot make already-public bytes private. Direct browser uploads remain disabled, so no upload CORS policy or browser credentials were added.

## Draft, preview and publication

Pages retain Payload drafts/versions. Public reads explicitly omit the authenticated user, so even a logged-in visitor sees published content at normal routes. `/preview/[slug]` authenticates the current Payload session and requires admin/editor access on every request; anonymous preview returns 404. Payload's Preview button opens this route. Both preview and public pages are dynamically rendered with `revalidate = 0`; there is no cross-request content cache and no manual rebuild after publication. Request-local React memoization deduplicates reads only within that request.

Media itself is not versioned. Replacing a file updates every referencing page immediately. To stage an image relationship, upload a public image, choose it in the page's Image field and save a draft; the page relationship is versioned, but the uploaded bytes are already public. Private file workflows are out of scope.

## Verification

Prior Mission 001 evidence is not counted as a new Mission 002 PASS. The final live run and screenshot evidence are linked in the completed results below.

| Command/check | Mission 002 result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; no global suppression |
| `npm run build` | PASS, dynamic public/admin/API routes |
| `npm run check:generated` | PASS, types and import map consistent |
| `npm run test:unit` | PASS, 9 tests |
| `npm run verify:local` | PASS: bootstrap 1; main browser suite 20; restart 1; 4 deliberate skips |
| Clean SQLite migrations/import/rerun | PASS; both migrations; 20 created then 20 preserved |
| Approved additive Turso migration | PASS, batch 2; initial record counts preserved |
| Actual R2 upload/public delivery | PASS, 12 media and 24 original/thumbnail objects |
| `node --import tsx scripts/verify-website.ts --approved-live-poc` | PASS: Chromium comparison, draft/preview/publish, file replacement, restart, denied writes, restoration and cleanup |
| Final Turso read-only inventory | PASS: 7 published pages, 32 page sections, 12 media, 2 shared sections, 0 users/sessions |
| Browser credential scan | PASS: 76 static assets; no configured server credential or R2 API endpoint matches |

Logs and screenshots are under `evidence/mission-002/`. The historical QA scripts/assets are retained. One initial unit fixture lacked Payload's request context; its fixture was corrected to match real hook input. The first reference fixture location was inside `.data` and got linted; it was moved to `/tmp`, leaving the app lint boundary intact. The reference build uses webpack because Turbopack could not resolve its symlinked dependencies; the target's normal Turbopack production build passes. One live run was interrupted before editorial tests and its task-owned servers were stopped. A later run completed draft/publish/image/restart checks but failed the denial test because the harness used PATCH for the global endpoint; Payload global updates use POST. The test was corrected, with actual 401/403 assertions retained. Earlier failed/interrupted run reports are preserved.

## Manual demo for Tony

1. Use Node from `.nvmrc`. Preserve the securely configured `.env.local`; it selects remote **test** Turso/R2. Keep port 3001 free. `npm run dev` binds only to `127.0.0.1`.
2. If no admin exists, use README's hidden terminal password entry and `npm run admin:create`. `BOOTSTRAP_TARGET_HOST` must match the approved hostname. Never put credentials in chat or command arguments. The test harness removes its temporary admin.
3. Open `http://127.0.0.1:3001/` and each route above; open `/admin` and log in.
4. Open **Pages → Home → Website sections → Show All**. Change the first **Hero heading**. **Save Draft**. Refresh `/`: the published heading stays unchanged. Use **Preview** or `/preview/home`: the authenticated view shows the draft.
5. Click **Publish changes**, then refresh `/`: the new heading appears without rebuild. The second/accent line is a separate field, preserving the original design.
6. Open the image referenced by Home's first section in **Media**. Remove the selected file in the form, choose a new JPEG/PNG/WebP under 3 MiB, retain **public**, and **Save**. Refresh `/` to see the new file. File replacement preserves the relationship and website prefix. Keep useful original assets if doing a real edit.
7. Change shared navigation/footer/contact values in **Site Settings**. Stop and restart the app with the same environment; verify heading, image and settings persist.

No remote migration/import is needed for this demo: the site is already imported. Do not run the Mission 001 empty-database remote verifier against the populated website.

## Reproduce engineering checks

Run the static checks above and `npm run verify:local` with Chromium installed. This explicitly selects a new disposable SQLite/local-media environment even when `.env.local` selects Turso/R2. On this host use `PATH=/tmp/stark-node-runtime/node_modules/.bin:$PATH` and `PLAYWRIGHT_BROWSERS_PATH=/tmp/stark-playwright`.

For the bounded live workflow, keep ports 3001/3002 free and ensure no operator users or concurrent editorial changes exist. `npm run reference:prepare` selectively prepares a renderer in `/tmp/stark-mission002-reference-site` and refuses to overwrite one. Build it there with `node node_modules/next/dist/bin/next build --webpack`. This does not build or modify the original reference repository. Then run `npm run verify:website -- --approved-live-poc`. The harness guards targets, generates temporary credentials in memory, compares actual pages, tests edits and restart, restores original heading/image, and removes only its own administrator. No login traces or credentials are archived. Existing imported content remains.

## Security and boundaries

The [Monaco/DOMPurify assessment](DEPENDENCY-SECURITY.md) remains open: **production release BLOCKED**. No dependency update or remediation claim was made in Mission 002. Structured fields use normal Payload inputs, not Monaco JSON/Code fields. Loopback/disposable-resource engineering does not certify security or QA.

No cloud provisioning, DNS change, deployment, commit, push, merge or reset. Final Git inventory and preservation checks are included with the completed results below.


## Completed live results and visual evidence

**MISSION 002 ENGINEERING VERIFIED — ready for independent QA.** [Final live report](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/results.json), [final Turso inventory](../evidence/mission-002/final-turso-inventory.json), [final local regression log](../evidence/mission-002/local-final.log), [SQLite persistence proof](../evidence/mission-002/local-final/local-proof.json).

Chromium ran against the production build on loopback and the actual selectively copied reference renderer. Fourteen page/device pairs (1440×900 desktop, 375×812 mobile) have corresponding full-page screenshots. All rendered body text, SEO titles/descriptions, section positions/heights and document dimensions matched. Navigation, keyboard dismissal, FAQ details, 404s and overflow checks passed. The changed-pixel proportion was **0.117%–0.446%**, counting pixels with any RGB channel difference greater than 20/255. The illustrations are PNG rasterizations of reference SVGs; their anti-aliasing/text rendering explains remaining visual differences. This is substantial design fidelity, not pixel-perfect parity. Representative desktop Home and mobile Contact captures were also visually inspected.

Representative pairs: [desktop Home reference](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/desktop-home-reference.png) / [target](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/desktop-home-target.png), [mobile Contact reference](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/mobile-contact-reference.png) / [target](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/mobile-contact-target.png).

Workflow captures: [public page while draft exists](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/draft-public-unchanged.png), [authorized preview](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/authorized-preview.png), [published heading](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/published-heading.png), [replaced image](../evidence/mission-002/live-11b62bb2-5a24-4757-bca3-3642549c0033/replaced-image.png).

The import rerun preserved all 20 records while an editor's heading was changed. Anonymous page/media PATCH and global POST each returned **403**; media deletion was denied too. Public draft API requests did not expose the edited heading, and anonymous preview returned 404. A fresh server process retained the published heading, changed image, settings and working login.

After testing, the original reference heading and image bytes were restored. Exactly 24 website R2 objects remain; there are no temporary users or user sessions. Payload version history retains the editing history normally. The seven real website pages and twelve media records are deliberately retained for Tony. Both task-owned servers are stopped. There are no remaining credentials, migration or integration blockers; the unresolved critical dependency still blocks **production release**.

## Final repository disposition

Branch: `feat/p1-payload-turso-gcs-poc`. HEAD: `7715f6de3850e210b5b52a5049a6f1144a50c04c` (unchanged). Working tree remains intentionally uncommitted and includes both the preserved Mission 001 foundation and Mission 002 work. [Full status](../evidence/mission-002/final-git-status.txt), [Mission 002 changes relative to checkpoint](../evidence/mission-002/change-inventory.json), [preservation/secret checks](../evidence/mission-002/preservation.json).

Primary changes: public route/layout/template components; fixed website fields and CMS readers; additive migration/index/generated types; source-content importer and bounded verification tools; fonts/licenses; updated local/browser tests, README and this handoff. Dependency versions and the Mission 001 lockfile are unchanged. All 218 checked prior evidence/foundation files and all 34 inspected reference files retain their original hashes. The reference Git tree remains clean on `main`; `.env.local` remains ignored with mode 600. No commit, push, merge, reset, cloud provisioning or deployment occurred.
