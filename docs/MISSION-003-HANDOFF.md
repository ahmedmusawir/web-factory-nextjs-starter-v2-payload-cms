# Mission 003 — WordPress blog, ISR and container preparation

The seven existing CMS pages remain; `/blog` and `/blog/[slug]` render real WordPress articles through Payload. Tony's administrator is retained. No reset, reference-repository modification, commit, push or deployment.

## Import and media

Selected 12 full-length published articles from a bounded 20-post REST response with embedded media/categories. The newest article had an empty body and was excluded. [Public source snapshot](../evidence/mission-003/wordpress-source.json), [import/rerun record](../evidence/mission-003/import-results.json).

All 12 articles also pass an exact normalized full-text comparison against the sanitized source ([content proof](../evidence/mission-003/content-verification.json)): 39 inline uploads and both tables are retained.

Posts add stable source ID/digest, WordPress ID, original URL and category names. Original slugs/dates/titles and full content are retained. Existing SEO title/description limits remain 70/170 characters; the source snapshot retains original metadata. No separate CMS or migration framework was added. The listing displays all 12 articles; pagination is unnecessary for this sample.

HTML is allowlist-sanitized before Payload's official HTML-to-Lexical conversion. Scripts, event handlers, styles, embeds and unsafe URLs are removed. Headings, paragraphs, lists, emphasis, links, captions, inline uploads and the two source tables remain. The pinned Payload `EXPERIMENTAL_TableFeature` enables those tables in admin and public rendering; retain that experimental-feature limitation in release review. Source bodies contain their own H1 headings, which are preserved alongside the article layout title.

Forty-four distinct source image URLs became Payload Media records and **88 original/thumbnail objects** under `R2_PREFIX/wordpress-blog`. Original website media remains separate and retained. Supported JPEG/PNG/WebP originals are preserved; only files exceeding 3 MiB are resized/re-encoded to fit the existing upload limit. No SVG conversion was introduced. Legacy staging-host URLs resolve through the matching approved live WordPress uploads path. Downloads use serial requests, timeout/size checks, three bounded attempts and a local public-image cache.

[Actual R2 object/public-byte verification](../evidence/mission-003/r2-verification.json) compares SHA-256 for originals and thumbnails. Featured/inline relationships are Payload uploads; metadata lives in Turso. Existing imported records are skipped on rerun, even after editor changes; unrelated slug collisions stop before writes. There is no automatic content refresh/overwrite.

The generated migration `20261115_065237_wordpress_blog` has 16 additive CREATE/ADD statements. An unrelated generated Media-table rebuild caused by environment-dependent defaults was removed before remote execution. [Remote migration](../evidence/mission-003/remote-migration.json) records the original 1 user / 7 pages / 0 posts / 12 media baseline. No existing table was reset or rebuilt remotely.

## 30-second ISR and evidence

Public layouts/routes use `revalidate = 30`; dynamic slug routes return an empty `generateStaticParams` list for on-demand generation. Public queries use anonymous, published-only access. Request headers are read only in authorized preview paths. No persistent data cache is layered over the full-route cache.

Payload change/delete hooks invalidate affected public page/article paths and the relevant listing. Settings/media changes invalidate the public layout; old/new slugs are handled. CLI imports skip Next invalidation and should be followed by the build or normal timed regeneration. Draft writes cannot expose unpublished content. Preview uses the current Payload session on every request.

[Production build](../evidence/mission-003/build.log): `/`, `/blog` and `/content` are static with 30-second revalidation; website/blog/legacy detail slug routes are SSG/ISR-capable. Admin, CMS/GraphQL APIs, authorized previews and database readiness deliberately remain dynamic. The framework 404 is static.

[Live ISR/browser proof](../evidence/mission-003/live-0de8404b-7d79-487c-88bc-91bf7014c808/results.json) and its `render-counts.log` demonstrate:

- All seven pages, listing and a real article return `x-nextjs-cache: HIT`.
- Isolated page and article fixtures progress from MISS to HIT; repeated cached requests add **zero instrumented CMS reads**.
- A published update made without invalidation stays absent within the interval. After 31 seconds, a request returns STALE and regeneration retrieves the update.
- Anonymous draft reads/previews are denied; authenticated Chromium sees the draft. Publication invalidates the cache and updated output appears without rebuilding.
- All 12 full article bodies and featured/inline images render at desktop/mobile sizes without horizontal overflow. Restart preserves the articles. Unauthorized writes return 403.

The counters measure application Payload-read calls, not individual SQL statements or background connections. Thirty seconds is an eligibility interval: requests drive regeneration, and an initial stale response may precede refreshed output. It is not a periodic rebuild timer. Test fixtures/accounts were removed through owned-ID cleanup; original user identities/roles were compared before/after.

## Regression results

| Check | Result |
| --- | --- |
| TypeScript, lint, production build | PASS; logs in `evidence/mission-003/` |
| Unit tests | PASS, 11 including malicious-HTML sanitizer cases |
| Payload types/import-map consistency | PASS |
| Clean SQLite migrations and persistence | PASS, all three migrations; repeat migration no-op |
| Local Chromium suite | PASS: 20 main tests, 1 bootstrap, 1 restart; 4 intentional skips |
| Turso import and R2 originals/variants | PASS |
| Live ISR, draft/preview/publish, restart | PASS |
| Chromium table-rich article editing, Save Draft and Publish | PASS; original article untouched |
| Standalone server, admin page/API, readiness, fonts | PASS on loopback port 3005 |
| Docker image build | NOT RUN: Docker is unavailable on this host |

[Local regression log](../evidence/mission-003/local-regression.log), [standalone smoke](../evidence/mission-003/standalone-smoke.json), [artifact credential scan](../evidence/mission-003/artifact-secrets.log). The initial local converter failure was fixed by normalizing upload IDs to numbers; protocol-relative images were normalized to HTTPS. A live-test selector initially matched both article H1s and was narrowed. Generated isolated build directories were added to the lint ignore boundary; source lint remains enabled. Earlier failures are retained in the evidence.

[Focused admin editing proof](../evidence/mission-003/blog-editor.json) and [clean final desktop/mobile screenshots](../evidence/mission-003/final-browser/results.json) supplement the live suite. The temporary editor account and copied article were removed; original user IDs remained unchanged.

## Container / Cloud Run review

The supplied reference checkout contains **no Dockerfile or deployment scripts**, so its claimed previous deployment configuration could not be reused. `Dockerfile` and `.dockerignore` prepare a Node 22.23.5 multi-stage image, non-root runtime, standalone Next server, static assets and explicit operator migration target. `BUILD_STANDALONE=1` is container-build-only; ordinary `npm start` keeps the standard Next server mode.

BuildKit's required `app_env` secret supplies approved build-time configuration. Never use credential build arguments or copy environment files into the build context. Generated environment files are removed before the layer completes, and a configured-secret scan gates the final standalone/static artifacts. ISR build output contains published content, so build against the intended target; do not promote cached content between clients/environments.

After security approval, image review can use:

```sh
docker build --target runtime --secret id=app_env,src=.env.local -t web-factory-poc:review .
```

No deployment command was run. Runtime injects `PAYLOAD_SECRET`, the documented Turso variables/target confirmations, and all R2 variables from secret management. Keep `APP_ENV=test` for this disposable POC. Server binds to `0.0.0.0:$PORT` (default 8080), as required by the [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract). `/health/ready` performs a real read and returns 503 if unavailable. Admin/API routes remain in the same server.

Run reviewed migrations explicitly with the `operator` image target and `npm run db:migrate`, with matching `MIGRATION_TARGET_HOST`; never migrate during web startup. Roll back application traffic to the previous compatible known-good revision/image, retaining additive schema and content. That revision must support the imported Lexical table nodes; do not assume an older editor configuration can edit them. Do not execute migration down/reset as rollback.

For an initial POC, constrain to **one instance** and use instance-based CPU allocation so background ISR can finish. Local ISR state is ephemeral and per instance; a shared cache/invalidation design is required before multiple replicas. [Next self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting). The image itself still needs a real Docker build and container smoke test. No existing Cloud Run service or DNS was touched.

## Security and remaining gates

Fresh audit: **1 critical, 0 high, 12 moderate, 10 low**. Monaco's latest stable remains 0.57.0 with vendored DOMPurify 3.4.15. No compatible fixed stable release was identified; no override or bundle patch was applied. [Assessment](../evidence/mission-003/security.json), [audit](../evidence/mission-003/audit.json), [upstream releases](https://github.com/microsoft/monaco-editor/releases).

**Public Payload exposure and production deployment remain BLOCKED** pending an approved security resolution. Container build/Cloud Run behavior is not certified. No independent QA certification is claimed.

## Tony's local demo

Your existing port-3001 server was left running. When ready, stop it yourself, then use the supported Node runtime and the verified isolated build:

```sh
NEXT_DIST_DIR=.next-mission003 npm start
```

Open `/blog`, choose an article, and log in at `/admin/login` with your existing account. Edit a Post, Save Draft, inspect `/preview/posts/SLUG`, then Publish. Refresh the public article after regeneration. Existing website Pages retain the same workflow. A fresh standard `npm run build && npm start` is also supported once your old server is stopped.

`npm run verify:local` now builds against its own disposable SQLite target before browser checks, preventing ISR snapshots from crossing environments. Use `TEST_PORT=3004` to keep port 3001 free. The live harness uses port 3003 and temporary accounts only; never run it concurrently with another process on that port.

Branch remains `feat/p1-payload-turso-gcs-poc`; HEAD remains `7715f6de3850e210b5b52a5049a6f1144a50c04c`. All work is uncommitted. Final source/evidence inventory is in `evidence/mission-003/`.

## Imported source articles

- WP 9628: [The Ultimate Guide to Acquiring More Pizza Shop Customers](https://cyberizegroup.com/the-ultimate-guide-to-acquiring-more-pizza-shop-customers/)
- WP 9645: [How to Rank High on Google: A Step-by-Step Guide](https://cyberizegroup.com/how-to-rank-high-on-google-a-step-by-step-guide/)
- WP 9653: [Content Scaling: Strategies for Growing Your Audience and Reach](https://cyberizegroup.com/content-scaling-strategies-for-growing-your-audience-and-reach/)
- WP 9656: [The Ultimate SEO Content Template: How to Create SEO-Friendly Content in Minutes](https://cyberizegroup.com/the-ultimate-seo-content-template-how-to-create-seo-friendly-content-in-minutes/)
- WP 9657: [What is a Sitemap and How to Create One for Your Website](https://cyberizegroup.com/what-is-a-sitemap-and-how-to-create-one-for-your-website/)
- WP 9663: [Unlocking the Power of SEO Copywriting: What You Need to Know](https://cyberizegroup.com/unlocking-the-power-of-seo-copywriting-what-you-need-to-know/)
- WP 9664: [How to Write SEO-Friendly Content: A Step-by-Step Guide](https://cyberizegroup.com/how-to-write-seo-friendly-content-a-step-by-step-guide/)
- WP 9666: [10 Proven Strategies to Optimize Your Content for Search Engines](https://cyberizegroup.com/10-proven-strategies-to-optimize-your-content-for-search-engines/)
- WP 9673: [Boost Your Dental Practice with a Professional SEO Company](https://cyberizegroup.com/boost-your-dental-practice-with-a-professional-seo-company/)
- WP 9675: [The Essential Guide to Developing a Winning Digital Marketing Strategy](https://cyberizegroup.com/the-essential-guide-to-developing-a-winning-digital-marketing-strategy/)
- WP 9686: [Maximize Your eLearning ROI with a PPC Agency](https://cyberizegroup.com/maximize-your-elearning-roi-with-a-ppc-agency/)
- WP 9687: [Garage Door Repair PPC Agency – Get More Leads & Sales Now!](https://cyberizegroup.com/garage-door-repair-ppc-agency-get-more-leads-sales-now/)
