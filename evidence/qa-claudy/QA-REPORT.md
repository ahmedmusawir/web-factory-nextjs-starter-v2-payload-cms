# Operation Turso — weekend POC QA (Claudy, independent pass)

Date: 2026-11-14. Branch `feat/p1-payload-turso-gcs-poc`, HEAD `7715f6d` (unchanged, still uncommitted).
Node 22.23.5 from `/tmp/stark-node-runtime`, Chromium via Playwright 1.59.1.
Targets: Turso `web-factory-v2-poc-db`, R2 `stark-web-factory-poc-media`. Loopback only.

## A. Overall verdict

**POC QA: PASS for manual CMS exploration. Production release: BLOCKED** (critical Monaco/DOMPurify finding unresolved).

No functional defect found in the seven pages or the Payload/Turso/R2 workflow. Six minor findings in section J.

## B. Seven-page website — PASS

Compared against the reference renderer at 1440×900, 768×1024 and 375×812 (21 page/viewport pairs).

| Check | Result |
| --- | --- |
| Routes `/`, `/seo-services/`, `/ppc/`, `/website-design/`, `/web-development/`, `/website-support/`, `/contact/` return 200 | PASS |
| Body text, title, meta description, headings identical to reference | PASS, 21/21 |
| Section positions/heights, document height, image boxes and alt text identical | PASS, 21/21 |
| Link sets identical; internal links resolve; `#top`, `#process`, `#planning` anchors exist | PASS |
| Images load, all served from the R2 public origin | PASS, 0 broken |
| Horizontal overflow | PASS, none |
| Console errors / page errors / HTTP ≥400 | PASS, none |
| Mobile menu, Services dropdown, Escape + focus return, FAQ details, 404 page | PASS |
| Pixel difference vs reference (channel delta > 20) | 0.18%–1.42%, from SVG→PNG rasterisation of illustrations |

Trailing-slash links 308 to the no-slash URL, same as the reference.

## C. Payload admin — PASS

Real Chromium login with a CLI-bootstrapped random admin. Users, Pages (7), Posts (0), Media (12), Site Settings all open with stored data. Anonymous `/admin` redirects to login.

NOT TESTED: editing Site Settings through the UI (viewed only), admin on mobile.

## D. Turso — PASS

- 2 migrations applied (batch 1 and 2); none run by QA. Target guards in `cms/environment.ts` and `create-admin.ts` read and exercised.
- Heading edits observed directly in Turso: draft only in `_pages_v`, published row changed only after Publish.
- Local SQLite not in use: no bytes or rows written under `.data/`; rows verified by direct libSQL SELECT.
- After stopping and starting a fresh server: published heading, post→media relationship, settings/logo, session and login all persisted.

## E. R2 — PASS

- 24 objects under `stark-poc/`, all 12 site images load.
- Disposable 800×600 PNG uploaded through the admin UI → 201; original + 400×300 thumbnail present in R2; Turso row matches (key, size, dimensions); public URL returns identical bytes (SHA-256).
- Anonymous upload → 403; private upload → 400; neither created an object or row. Public→private → 400. Client cannot rewrite `objectKey`/`prefix`.
- Relationship: disposable published post with the image resolved for anonymous readers and rendered at `/content`.
- Deleted via Payload: both objects gone, public URL 404, exactly 24 site objects remain.

NOT TESTED: replacing the file on one of Cody's imported media records (avoided touching site media).

## F. Edit / preview / publish — PASS

On Home → Hero heading, through the admin UI: Save Draft 200 → public page and anonymous API unchanged → Preview link present, authenticated `/preview/home` shows the draft → Publish → public page updates on next request, no rebuild → original heading restored and published; Home text again identical to reference. No source change needed.

## G. Security

| Check | Result |
| --- | --- |
| Anonymous writes (pages, posts, media, settings, users, first-register; REST and GraphQL) | PASS, all 403 |
| Anonymous draft access (REST `draft=true`, versions, GraphQL, `/preview/home`, draft post routes) | PASS, 403/404, draft text never returned |
| Anonymous user/preferences/locks/kv reads | PASS, 403 |
| Editor role: cannot create users, escalate role, delete content/media; sees only own user | PASS |
| Credentials in public responses and 76 static build files | PASS, none found |
| Password hash/salt in user API | PASS, absent |
| Private files | NOT APPLICABLE — bucket is fully public by design; private uploads are rejected |
| Monaco/DOMPurify critical (GHSA-cg2g-xh64-v4q7 and others) | **FAIL — unresolved** |

`npm audit`: 1 critical, 0 high, 12 moderate, 10 low. `monaco-editor@0.57.0` vendors DOMPurify 3.4.15; the shipped loader chunk points at `monaco-editor@0.55.1` on jsDelivr. Not waived.

## H. Regression — PASS

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, zero warnings |
| `npm run test:unit` | 9 passed, 0 failed |
| `npm run check:generated` | consistent |
| `npm run build` | exit 0, all app routes dynamic |
| `npm run verify:local` (disposable SQLite) | 1 + 20 + 1 passed, 4 skipped, exit 0 |
| `npm run dev` smoke | `/` 200, `/admin/login` 200, `/preview/home` 404 anonymous |

## I. Manual test readiness — READY, with two prerequisites

1. No admin exists (users = 0). Create one with the README hidden-password procedure and `npm run admin:create`.
2. Node: system Node is 26.7.0 and nvm has 24.16.0; neither satisfies `engines`. The working 22.23.5 runtime lives in `/tmp/stark-node-runtime` and will not survive a reboot.

## J. Failures and findings

1. **Critical, production blocker — Monaco/DOMPurify.** As above. Smallest repair: none available upstream yet; keep the release hold.
2. **Minor — orphan rows after user deletion.** `payload_preferences` has 7 rows and `payload_locked_documents` 1 row (Home, page 2), all with no user. Two preference rows predate QA; the rest are from QA's deleted users. Repro: log in, open a page, delete the user. Repair: `afterDelete` hook on Users that removes that user's preferences and locks, plus a one-off cleanup.
3. **Minor — admin calls www.gravatar.com.** The admin UI requests a Gravatar for the logged-in email, so a hash of it leaves loopback. Repair: `admin: { avatar: 'default' }` in `payload.config.ts`.
4. **Low — no security headers.** No CSP, `X-Frame-Options` or `X-Content-Type-Options`; `X-Powered-By: Next.js, Payload` is sent. Repair before any deployment: `headers()` in `next.config.mjs`, `poweredByHeader: false`.
5. **Low — `npm run dev` dirties a tracked file.** `next-env.d.ts` is rewritten to `.next/dev/types`. Repro: `npm run dev`, `git status`. `npx next typegen` restores it (done). Repair: untrack/ignore the file.
6. **Info — aborted prefetches.** Non-home pages log `/?_rsc=… net::ERR_ABORTED` requests the reference does not. No console error or visible effect; cause not investigated.

## QA residue left behind

- 3 extra Home version rows in `_pages_v` (normal Payload history).
- The orphan preference/lock rows in finding 2.
- Nothing else: 0 users, 0 sessions, 7 published pages, 12 media, 0 posts, 24 R2 objects. Servers stopped, ports 3001/3002 free.

## Evidence

`website/` (screenshots + `results.json`), `cms/` (screenshots + phase results), `logs/`, `verify-local/`, `scripts/` (the QA drivers). No credentials stored.
