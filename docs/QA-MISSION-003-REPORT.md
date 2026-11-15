# QA Mission 003 — independent report: WordPress blog + 30-second ISR

QA executor: Claudy · 2026-11-15 · one focused run, no product code changed, nothing committed or deployed.

## A. Overall verdict

**FUNCTIONAL QA: PASS — READY FOR DEVOPS DEPLOYMENT PREPARATION.**
**PUBLIC PRODUCTION RELEASE: NOT APPROVED** — the critical Monaco/DOMPurify advisory is still open, the Docker image has never been built, and section K lists deployment findings.

| Area | Result |
| --- | --- |
| Seven original pages | PASS |
| WordPress content fidelity (12 articles) | PASS, with minor SEO-field transformations |
| Blog frontend | PASS, with minor SEO/performance findings |
| R2 media (56 records, 112 objects) | PASS |
| 30-second ISR (A–J) | PASS |
| Payload editorial workflow | PASS (temporary QA accounts; Tony's login not used) |
| Security controls | PASS; critical dependency advisory OPEN |
| Typecheck, lint, unit, build, generated check | PASS |
| Local SQLite regression suite | BLOCKED as shipped (reference checkout missing); PASS with a temporary shim |
| Standalone (container-equivalent) runtime | PASS |
| Docker image build / Cloud Run | NOT TESTED (Docker not installed) |

### Scope and baseline

- Branch found: `deploy/p1-payload-turso`, not the expected `feat/p1-payload-turso-gcs-poc`. Both, and `main`, point at the same commit `32ed31e`. I did not switch branches.
- The work is committed. The handoff's "HEAD `7715f6d`, all work uncommitted" lines are out of date. The only untracked path at start was `agent_docs/SKILLS/`.
- The reference checkout `../web-factory-poc-site-1` **does not exist on this machine**. I compared against the hash-verified copy that Mission 002 prepared in `/tmp/stark-mission002-reference-site`.
- Runtime: Node 22.23.5 from `/tmp/stark-node-runtime` (lost on reboot). The host's own Node versions (26.7.0, nvm 24.16.0) are both outside `engines`.
- Targets used: Turso `web-factory-v2-poc-db`, R2 `stark-web-factory-poc-media`, both guarded in every script.
- ISR was tested on **my own fresh production build**, not only Cody's. Cody's `.next-mission003` was also smoke-tested: all 7 pages, `/blog`, 2 articles 200 and `HIT`, 12 cards.

All evidence is under `evidence/qa-claudy/mission-003/` (`$Q` below).

## B. Seven-page regression — PASS

Chromium, 1440×900 / 768×1024 / 375×812, 21 page/viewport pairs against the reference renderer.

| Check | Result |
| --- | --- |
| HTTP 200, one H1, title, meta description, headings, section positions | 21/21 identical to reference |
| Body text | Identical except the new **Blog** nav link (intended) |
| Images | 0 broken; boxes and alt text match; all from the R2 public origin |
| Console errors, failed requests, horizontal overflow | None |
| Internal links | All resolve; only addition is `/blog` |
| Navigation, Services dropdown, Escape/focus return, mobile menu, FAQ, skip link, 404 | PASS |
| Pixel difference vs reference | 0.20%–1.33% (same SVG→PNG rasterisation range as Mission 002) |

Evidence: `$Q/website/results.json`, screenshots in `$Q/website/`.

## C. WordPress content fidelity — PASS

One bounded request to the public REST API for the 12 IDs, compared with Turso by read-only SQL.

| Check | Result |
| --- | --- |
| Article count, WordPress IDs, slugs, titles, original URLs | 12/12 match |
| Publication dates (`date_gmt`) | 12/12 match |
| Body text, whitespace-normalised | **12/12 identical** (11,485–21,490 characters each) |
| H1/H2/H3, list items, tables (2), blockquotes (4), inline images (39) | Counts identical in all 12 |
| Live WordPress vs Cody's snapshot vs stored digest | Identical; source has not changed since import |
| Featured images | 12/12 resolve to the right source file and dimensions |
| Categories | 12/12 match (8 Online Marketing, 4 Agency Services) |
| Excerpts | 12/12 identical (they keep WordPress's trailing `[…]`) |
| SEO title | 11/12 exact; WP 9656 is cut at 70 characters |
| SEO description | 10/12 exact; WP 9653 and 9666 have no Yoast description, so the excerpt was used and cut mid-word at 170 characters |

Transformed or not carried over: inline `<span>` styling and the author name. Paragraph-node counts are slightly higher in 3 articles (WP 9664, 9675, 9686: +4, +3, +8) because the converter wraps some blocks differently; the text is unchanged. The source bodies contain **no links**, so link conversion is only covered by unit tests. No tags exist in the source.

**Idempotency:** verified without rerunning the importer (it has no dry-run mode and would overwrite Cody's `import-results.json`). A read-only replay of its decisions gives 12 skip / 0 import / 0 slug collisions; no duplicate source IDs in posts or media; unique indexes exist on `posts.slug`, `posts.source_i_d`, `posts.wordpress_i_d`, `media.source_i_d`.

Evidence: `$Q/wordpress/compare.json`, `$Q/wordpress/idempotency.json`.

## D. Blog frontend — PASS

| Check | Result |
| --- | --- |
| `/blog` at 3 viewports | 200; 12 cards, newest first; titles, dates, categories correct; 12/12 images load; no overflow, no console errors |
| 12 articles × desktop and mobile | 24/24: 200, rendered body length equals stored text exactly, all images load from R2, no overflow, no console or network errors |
| Tables on mobile | Fit the 327 px column |
| Title and meta description | Present and correct on all 12 |
| Unknown slug | 404 |
| Draft / unpublished article | 404 publicly, absent from listing and anonymous API |
| `/blog/` | 308 → `/blog` |

Minor findings are in K (two H1s, relative canonical, no Open Graph, full-size images).
Evidence: `$Q/blog/results.json`, screenshots in `$Q/blog/`.

## E. R2 media — PASS

- Bucket listing: **112 objects, none unexpected** — 88 under `stark-poc/wordpress-blog`, 24 under `stark-poc/web-factory-poc-site-1`.
- Turso: 56 media rows (44 blog + 12 website), all public, all with thumbnails. Every row maps to an original and a thumbnail object of the recorded size.
- All 112 public URLs return 200 with the recorded byte length, content type and decoded dimensions.
- Disposable upload test (twice: normal server and standalone): private upload rejected 400, SVG rejected 400, public upload stored under the base prefix with a randomised filename, thumbnail 400×300 generated, public bytes identical. Deleted through the admin API; both objects gone.
- After QA: bucket listing and all 112 SHA-256 hashes identical to the start.

Evidence: `$Q/r2-before.json`, `$Q/r2-final.json`.

## F. 30-second ISR — PASS

Production build, `next start`, read counts taken from the app's `CMS_READ` instrumentation (Payload read calls, not SQL statements).

| Objective | Result | Evidence |
| --- | --- | --- |
| A. Routes are static/ISR | PASS. Build table: `/`, `/blog`, `/content` prerendered at 30s; `/[slug]`, `/blog/[slug]`, `/content/[collection]/[slug]` generated on demand, then cached. Admin, API, GraphQL, preview and health are dynamic. | `$Q/logs/build.log` |
| B. Interval is 30 s | PASS. Prerender manifest 30; response header `s-maxage=30`; measured below. | `$Q/isr-anon-1.json` |
| C. Cached requests do no CMS reads | PASS. 20 routes × 5 repeats: 0 reads; 19 routes all `HIT`, and `/` returned `STALE` five times while its own regeneration was still in flight. 40 more repeats on a fixture article and listing: all `HIT`, 0 reads. First render costs 2–3 reads. | same, `$Q/logs/editorial-isr.log` |
| D. Revalidation after the interval | PASS. Content changed with no invalidation: `HIT`/old at 2, 7, 12, 17, 22 s (0 reads); `STALE`/old at 27 s (2 reads); `HIT`/new at 28 s. The cache entry was about 3 s old at the write. | `editorial-isr.log`, line "E timeline" |
| E. Published content updates | PASS for article and listing. | same |
| F. Publish-triggered invalidation | PASS. New article replaced a cached 404 on the next request; UI publish visible on the next request (~1 s); slug rename, unpublish, republish, delete, and a page fixture all correct on the next request. Media change invalidates the whole layout (`HIT` → `MISS`). | same |
| G. Drafts stay private | PASS. Draft saved in the admin UI: public page, REST, REST `?draft=true`, list, GraphQL `draft:true`, versions (403) and anonymous preview (404) never show it — **including after a forced timed regeneration while the draft existed**. | same |
| H. Preview is dynamic | PASS. Authenticated preview shows the draft with `no-store` and no `x-nextjs-cache`. A logged-in user on the public URL still gets the published version. | `$Q/editorial/preview-draft.jpg` |
| I. Admin and API dynamic and protected | PASS. `no-store`; see H. | |
| J. Regeneration failure | PASS. Server restarted with an invalid database token: cached pages kept returning 200 with the last good content; `/health/ready` 503; uncached routes 500 with no token or hostname in the body; failures were not cached; clean recovery on restart. | `$Q/logs/isr-db-failure.txt` |

Things to know:

- Regenerating `/` takes 2–3 s against Turso; requests in that window get `STALE` (old content), which is expected.
- 404s are cached too. See K-2.
- Not tested by write: Site Settings invalidation. It uses the same `revalidatePath('/', 'layout')` call that the media test exercised.

## G. Payload editorial workflow — PASS

Run in Chromium with a temporary QA admin and a temporary QA editor (both `@example.test`, created through the Local API, deleted afterwards). Tony's account was never logged into, edited or reset; its row is byte-identical before and after.

| Step | Result |
| --- | --- |
| Log in through `/admin/login` | PASS |
| Open Pages, Posts (12 rows), Media, Site Settings | PASS |
| Edit an article (disposable copy of WP 9675, with table) | PASS |
| Save Draft → public unchanged | PASS |
| Preview link present; preview shows the draft | PASS |
| Publish → public update on next request | PASS |
| Restore original title through the UI | PASS; stored content length identical, table node retained |
| Editor role: save draft, preview | PASS |
| Admin UI console errors / failed requests | None |

The run recorded 53 PASS and 4 FAIL. Three FAILs were my own probes, not product defects: I looked for a title that sits on page 2 of the default 10-row list; I checked the `/admin` redirect before it completed (the response is a 200 that streams a redirect to `/admin/login` and contains no data); I counted the editor's table before the editor finished loading. The fourth is real and minor (K-8, Gravatar).

Not tested: Tony's own credentials, editing Site Settings, admin on mobile, visual check of the table inside the editor.

Evidence: `$Q/editorial/results.json`, `$Q/logs/editorial-isr.log`, screenshots in `$Q/editorial/`.

## H. Security — controls PASS; release blocker OPEN

| Check | Result |
| --- | --- |
| Anonymous create/update/delete on posts, pages, media, site settings | 403 (8 requests) |
| Anonymous `POST /api/users` and `/api/users/first-register` | 403; `/admin/create-first-user` redirects to login |
| Anonymous users, preferences, versions | 403 |
| Anonymous GraphQL users query and post mutation | Forbidden; introspection disabled |
| Wrong password (QA account only) | 401 |
| Editor: create user, delete post/media, edit another user, raise own role | 403 each; role unchanged |
| Editor sees only own user record | PASS |
| Draft access | See F-G |
| Credentials in public pages and anonymous API responses (11 URLs) | None; no password fields, DB host or R2 API host |
| Credentials in tracked files, both builds, standalone runtime, all evidence | None (value scan of more than 4,000 files) |
| `.env.local` | Git-ignored, mode 600 |

**Critical dependency advisory — unchanged, not waived.** `npm audit`: **1 critical, 0 high, 12 moderate, 10 low** (same as Cody). Chain: `@payloadcms/next 3.93.0 → @payloadcms/ui → @monaco-editor/react 4.7.0 → monaco-editor 0.57.0 → dompurify 3.4.15`.

- Registry today: `monaco-editor` latest is still 0.57.0 (only a `0.58.0-dev` prerelease); `@payloadcms/next` latest is 3.93.0; `dompurify` latest is 3.4.18 (fixed from 3.4.17).
- npm reports `fixAvailable: true`, but Monaco pins `dompurify` at exactly 3.4.15 and also ships its own copy of the file, so an override would not fix the vendored code. **No compatible supported fix exists yet.**
- In my build no static chunk contains a DOMPurify marker; one chunk references the CDN loader for `monaco-editor@0.55.1`. During the whole admin session the only third-party request was to `www.gravatar.com`; Monaco was never loaded.

I make no production security clearance. Evidence: `$Q/logs/audit.json`, `$Q/logs/secret-scan.txt`.

## I. Build / regression

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 warnings |
| `npm run test:unit` | PASS, 11/11 |
| `npm run check:generated` | PASS |
| `NEXT_DIST_DIR=.next-qa-claudy npm run build` | PASS; route table matches Cody's |
| `BUILD_STANDALONE=1 NEXT_DIST_DIR=.next-qa-standalone npm run build` | PASS |
| `npm audit --json` | Findings as in H |
| `TEST_PORT=3004 npm run verify:local` | **BLOCKED as shipped**: `ENOENT …/web-factory-poc-site-1/public/cyberize/assets/conversation.svg` |
| Same, with a temporary symlink `../web-factory-poc-site-1 → /tmp/stark-mission002-reference-site` | PASS: bootstrap 1, main 20 (4 intentional skips), restart 1, repeat migration no-op. Symlink removed. |

All run with `PATH=/tmp/stark-node-runtime/node_modules/.bin:$PATH` and `PLAYWRIGHT_BROWSERS_PATH=/tmp/stark-playwright`. Logs: `$Q/logs/`, summary in `$Q/logs/static-summary.txt`.

## J. Cloud Run readiness — reviewed; image NOT TESTED

Docker is not installed, so the image was not built. I built the same standalone output the Dockerfile builds, assembled the runtime directory the way the `runtime` stage does (standalone + static + public), and ran `node server.js` with configuration supplied **only through process environment**.

| Item | Finding |
| --- | --- |
| Node version | `node:22.23.5-bookworm-slim` exists on Docker Hub; matches `.nvmrc` and `engines` |
| Start command and port | `node server.js` honours `PORT` and `HOSTNAME`; verified on 8080. Dockerfile sets `0.0.0.0:8080` and runs as `node` |
| Routes in standalone | Health, `/`, `/seo-services`, `/blog`, an article, admin login, API, fonts, 9 static assets: all correct; ISR `MISS → HIT` works |
| Admin/API runtime | Login 200, authenticated admin page 200, upload 201 with sharp thumbnail, R2 write and delete work. sharp and libsql native binaries are present in the trace |
| ISR cache location | Written to `<dist>/server/route-cache/` inside the app directory; the Dockerfile's `--chown=node:node` makes that writable |
| Environment contract | `APP_ENV`, `DATABASE_KIND`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `DATABASE_TARGET_HOST`, `PAYLOAD_SECRET`, `MEDIA_STORAGE`, `R2_BUCKET`, `R2_TARGET_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`, `R2_PREFIX` — these 14 were sufficient. Values are read at runtime, not baked in |
| Target guards | Mismatched or missing values fail closed (`Missing required environment variable: APP_ENV`) |
| Secrets in artifacts | None in standalone, static or the assembled runtime (2,228 files). Next copied no `.env` file into standalone; the Dockerfile's delete step is a safety net. Cody's `check-container-secrets.ts` passes on my build |
| Migrations | Not run at start-up; separate `operator` target, guarded by `MIGRATION_TARGET_HOST`. Three migrations applied on Turso (batches 1–3) |
| Health | `/health/ready` does a real read: 200 healthy, 503 with a bad DB token, **500 with missing configuration** |

Requirements for the DevOps skill:

1. Build the image for real and smoke-test it; nothing here proves the Dockerfile itself.
2. The build needs the BuildKit secret `app_env` **and network access to Turso**, because `/`, `/blog` and `/content` are prerendered from live data.
3. Run exactly **one instance** (`max-instances=1`) with CPU always allocated. The cache is per instance and on local disk; a publish only invalidates the instance that received it.
4. After every cold start the first request to `/`, `/blog` and `/content` serves the **build-time snapshot** once, then regenerates. Rebuild after large content changes, or keep a minimum instance.
5. Point the startup probe at `/health/ready`, not `/`: a container with no configuration still returns 200 for the prerendered `/` and `/blog`.
6. Do not put a CDN in front without a plan: pages send `s-maxage=30, stale-while-revalidate=31535970`, and publish invalidation does not reach a CDN.
7. Cloud Run's writable filesystem is memory; see K-2 before exposing the service.
8. Supply the 14 variables from Secret Manager; keep `APP_ENV=test` for this POC.

Evidence: `$Q/standalone/results.json`, `$Q/logs/standalone-*.log`.

## K. Failures and required actions

| # | Severity | Finding | Reproduce | Required action |
| --- | --- | --- | --- | --- |
| 1 | **Critical — blocks public release** | DOMPurify 3.4.15 inside Monaco 0.57.0; no supported fix upstream | `npm audit` | Keep the release hold; re-check on each Monaco/Payload release; closure criteria in `docs/DEPENDENCY-SECURITY.md` |
| 2 | Medium — before public exposure | Any unknown URL is rendered and **cached as a 404** (one CMS read and cache files per distinct URL), on `/[slug]`, `/blog/[slug]`, `/content/[collection]/[slug]`. On Cloud Run that cache is memory | `curl -i /qa-anything` twice → 404 `MISS` then `HIT`; files appear in `server/route-cache` | Bound it: reject unknown slugs without caching, or rate-limit at the edge |
| 3 | Medium — deployment | Per-instance cache, build-time snapshot after cold start, CDN header behaviour (J, items 3, 4, 6) | See J | Encode in the deployment configuration |
| 4 | Medium — repeatability | `npm run verify:local` needs a sibling checkout `../web-factory-poc-site-1` that is not on this machine | Run it | Vendor the 12 fixture assets into the repo or make the path configurable |
| 5 | Low | Docker image never built | — | DevOps step 1 |
| 6 | Low | Building with a new `NEXT_DIST_DIR` rewrites tracked `tsconfig.json` and `next-env.d.ts`; the lint ignore list names each build directory explicitly | Build with any new dist dir, `git status` | Use one ignored pattern (`.next-*`) and stop committing per-directory includes |
| 7 | Low — SEO | Every article has two H1s (layout title + body H1); canonical is a relative URL (no `metadataBase`); no Open Graph/Twitter/JSON-LD; `/sitemap.xml`, `/robots.txt`, `/favicon.ico` return 404; legacy `/content` and `/content/posts/<slug>` publicly duplicate every page and article with no canonical or noindex; 3 truncated SEO fields (C) | View source of any article | Fix before a public launch |
| 8 | Low — hardening | No `X-Frame-Options`/CSP/HSTS/nosniff headers; `X-Powered-By: Next.js, Payload`; auth cookie has `HttpOnly` and `SameSite` but no `Secure`; admin UI calls `www.gravatar.com` with the user's email hash; 5 wrong passwords lock an account for 10 minutes, so anyone who knows the admin email can lock Tony out; `MIGRATION_TARGET_HOST` and `BOOTSTRAP_TARGET_HOST` are stored in `.env.local`, so the per-operation confirmation is always satisfied | `curl -I /admin/login`; `$Q/standalone/results.json` | Address before the admin is reachable from the internet |
| 9 | Low — performance | `/blog` loads 12 full-size originals (1.24 MB; the thumbnails total 0.24 MB), up to 2048 px for a 405 px card; no lazy loading or `srcset`; featured-image `width`/`height` attributes do not match the real aspect ratio | Network panel on `/blog` | Use sized variants |
| 10 | Low | `/health/ready` returns 500 instead of 503 when configuration is missing (the config throws at import, outside the handler's try/catch) | Start standalone with no env | Still non-2xx, so probes work; tidy when convenient |
| 11 | Low — known from Mission 002 | Deleting a user leaves its preference rows behind | See below | Add a cleanup hook |
| 12 | Info | Preview banner is unstyled; the admin Posts list shows the full Content column by default; handoff's branch/HEAD statements are stale; no durable supported Node on this host | — | — |

### What QA left behind

- Turso: **4 orphan `payload_preferences` rows (ids 12–15)** from my deleted temporary admins (finding 11). I did not remove them with raw SQL. Everything else is identical to the start: 1 user (unchanged), 7 pages, 12 posts with 1 version each, 56 media, 3 migrations.
- R2: nothing. 112 objects, hashes identical.
- Repo: only `evidence/qa-claudy/mission-003/` and this report are new. `tsconfig.json` and `next-env.d.ts` were touched by my builds and restored byte-for-byte. My build directories and the temporary symlink are removed.
- `verify:local` (the suite's own behaviour) rewrote the ignored `.next-local-verification/`, `playwright-report/`, `test-results/` and added two disposable databases under `.data/test/`.
- All QA servers are stopped; ports 3001–3005 and 8080 are free. Tony's demo server was not running when I started and is not running now: `NEXT_DIST_DIR=.next-mission003 npm start`.

### Reproduce the main runs

```sh
export PATH=/tmp/stark-node-runtime/node_modules/.bin:$PATH PLAYWRIGHT_BROWSERS_PATH=/tmp/stark-playwright
Q=evidence/qa-claudy/mission-003
NEXT_DIST_DIR=.next-qa-claudy npm run build
NEXT_DIST_DIR=.next-qa-claudy ISR_DIAGNOSTICS=1 node node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3001 > $Q/logs/server-1.log 2>&1 &
node $Q/scripts/turso-inspect.mjs $Q/turso-before.json        # read-only
node $Q/scripts/wp-compare.mjs $Q/wordpress/live-posts.json $Q/wordpress/compare.json
node $Q/scripts/r2-verify.mjs $Q/r2-before.json               # read-only
node $Q/scripts/isr-anon.mjs $Q/logs/server-1.log $Q/isr-anon-1.json
node $Q/scripts/blog.mjs
node --import tsx $Q/scripts/editorial-isr.ts $Q/logs/server-1.log   # creates and removes its own fixtures
```
