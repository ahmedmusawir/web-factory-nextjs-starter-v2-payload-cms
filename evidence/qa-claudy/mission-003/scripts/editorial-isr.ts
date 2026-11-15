// QA Mission 003 — editorial workflow + ISR proof against the running production server (port 3001).
// Creates ONLY disposable fixtures (2 temp users, 1 post, 1 page, 1 media) and removes them by owned ID.
// Never logs in as, edits or deletes any pre-existing user or imported content.
// Run from repo root: node --import tsx evidence/qa-claudy/mission-003/scripts/editorial-isr.ts <server-log>
import '../../../../scripts/load-env'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, request } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readEnvironment } from '../../../../cms/environment'

const env = readEnvironment()
assert.ok(env.kind === 'turso' && env.appEnv === 'test' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(new URL(env.url).hostname))
assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
const LOG = process.argv[2]; assert.ok(LOG)
const T = 'http://127.0.0.1:3001', out = 'evidence/qa-claudy/mission-003/editorial'; mkdirSync(out, { recursive: true })
const run = `qa-claudy-m003-${randomBytes(4).toString('hex')}`, slug = run
const T0 = `QA CLAUDY DISPOSABLE ARTICLE ${run}`, T1 = `QA timed regeneration ${run}`, D1 = `QA PRIVATE DRAFT ${run}`
const adminEmail = `${run}-admin@example.test`, editorEmail = `${run}-editor@example.test`
const adminPw = randomBytes(32).toString('base64url'), editorPw = randomBytes(32).toString('base64url')
const { default: config } = await import('../../../../payload.config')
const payload = await getPayload({ config })
const results: { name: string; status: string; detail?: unknown }[] = []
const scrub = (s: string) => s.replaceAll(adminPw, '[pw]').replaceAll(editorPw, '[pw]')
const check = (name: string, ok: boolean, detail?: unknown) => { results.push({ name, status: ok ? 'PASS' : 'FAIL', detail }); console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail !== undefined ? ' — ' + scrub(JSON.stringify(detail)).slice(0, 600) : ''}`) }
const info = (name: string, detail: unknown) => { results.push({ name, status: 'INFO', detail }); console.log(`INFO: ${name} — ${scrub(JSON.stringify(detail)).slice(0, 600)}`) }
const reads = () => readFileSync(LOG, 'utf8').split('\n').filter(l => l.includes('CMS_READ'))
const anon = await request.newContext({ baseURL: T })
const get = async (p: string) => { const r = await anon.get(p, { maxRedirects: 0 }); return { status: r.status(), cache: r.headers()['x-nextjs-cache'], cc: r.headers()['cache-control'], body: await r.text() } }
const until = async (fn: () => Promise<boolean>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return Date.now() - t; await delay(250) } return -1 }
const usersBefore = (await payload.find({ collection: 'users', limit: 100, depth: 0 })).docs.map(u => [u.id, u.email, u.role, u.updatedAt])
const countsBefore = { posts: (await payload.count({ collection: 'posts' })).totalDocs, pages: (await payload.count({ collection: 'pages' })).totalDocs, media: (await payload.count({ collection: 'media' })).totalDocs }
const owned: { collection: 'users' | 'posts' | 'pages' | 'media'; id: number }[] = []
const s3 = new S3Client({ region: 'auto', endpoint: env.r2!.endpoint, forcePathStyle: true, credentials: { accessKeyId: env.r2!.accessKeyId, secretAccessKey: env.r2!.secretAccessKey } })
const objectExists = async (Key: string) => { try { await s3.send(new HeadObjectCommand({ Bucket: env.r2!.bucket, Key })); return true } catch { return false } }
const browser = await chromium.launch()
const issues: string[] = [], externalHosts = new Set<string>()
try {
  // ---------- setup
  assert.ok(usersBefore.length >= 1, 'Tony administrator must exist')
  const admin = await payload.create({ collection: 'users', context: { bootstrapAdmin: true }, data: { email: adminEmail, password: adminPw, role: 'admin' } }); owned.push({ collection: 'users', id: admin.id })
  const editor = await payload.create({ collection: 'users', context: { bootstrapAdmin: true }, data: { email: editorEmail, password: editorPw, role: 'editor' } }); owned.push({ collection: 'users', id: editor.id })
  const source = (await payload.find({ collection: 'posts', where: { wordpressID: { equals: 9675 } }, depth: 0, limit: 1 })).docs[0]; assert.ok(source)
  const sourceSnapshot = JSON.stringify(source)

  // ---------- A. unknown slug is a cached 404 before the article exists
  const a1 = await get(`/blog/${slug}`), a2 = await get(`/blog/${slug}`)
  check('A unknown article slug → 404, and the 404 is itself cached', a1.status === 404 && a2.status === 404, { first: a1.cache, second: a2.cache })

  // ---------- B. admin UI login + navigation
  const ctx = await browser.newContext({ baseURL: T, viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); page.setDefaultTimeout(45000)
  page.on('console', m => { if (m.type() === 'error') issues.push(`${new URL(page.url()).pathname} console.error: ${m.text().slice(0, 200)}`) })
  page.on('pageerror', e => issues.push(`${new URL(page.url()).pathname} pageerror: ${String(e).slice(0, 200)}`))
  page.on('response', r => { if (r.status() >= 400) issues.push(`${new URL(page.url()).pathname} http ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`) })
  page.on('request', r => { const h = new URL(r.url()).host; if (!h.startsWith('127.0.0.1') && !h.endsWith('.r2.dev')) externalHosts.add(h) })
  const unauth = await page.goto('/admin'); check('B anonymous /admin redirects to login', new URL(page.url()).pathname === '/admin/login', { url: new URL(page.url()).pathname, status: unauth?.status() })
  await page.goto('/admin/create-first-user'); await page.waitForLoadState('networkidle'); check('B /admin/create-first-user is closed (redirects to login)', new URL(page.url()).pathname === '/admin/login', new URL(page.url()).pathname)
  await page.goto('/admin/login'); await page.locator('input[name=email]').fill(adminEmail); await page.locator('input[name=password]').fill(adminPw)
  await page.getByRole('button', { name: /^log\s?in$/i }).click(); await page.getByRole('link', { name: 'Pages', exact: true }).first().waitFor()
  check('B temporary QA admin logs in through the admin UI (Chromium)', true)
  for (const [label, url, probe] of [['Pages', '/admin/collections/pages', 'Web Design'], ['Posts', '/admin/collections/posts', 'Garage Door Repair'], ['Media', '/admin/collections/media', ''], ['Site Settings', '/admin/globals/site-settings', '']] as const) {
    const r = await page.goto(url); await page.waitForLoadState('networkidle'); const text = await page.locator('body').innerText()
    check(`B admin opens ${label}`, r!.status() === 200 && !/not found|error/i.test(await page.title()) && (!probe || text.includes(probe)), { status: r!.status(), title: await page.title() })
    if (label !== 'Site Settings') await page.screenshot({ path: `${out}/admin-${label.toLowerCase()}.jpg`, type: 'jpeg', quality: 50 })
  }
  const postsListRows = await page.goto('/admin/collections/posts?limit=25').then(async () => { await page.waitForLoadState('networkidle'); return page.locator('table tbody tr').count() })
  check('B admin Posts list shows the 12 imported articles', postsListRows === 12, { rows: postsListRows })

  // ---------- C. create + publish disposable article through the authenticated API → on-demand invalidation of cached 404 and listing
  await get('/blog'); const listBefore = await get('/blog')
  const created = await ctx.request.post('/api/posts', { data: { title: T0, slug, excerpt: 'Disposable QA fixture. Safe to delete.', content: source.content, featuredImage: source.featuredImage, publishedAt: '2026-11-15T00:00:00.000Z', categories: ['QA'], _status: 'published' } })
  const post = (await created.json()).doc; if (post?.id) owned.unshift({ collection: 'posts', id: post.id })
  check('C admin creates + publishes disposable article via REST', created.status() === 201 && Boolean(post?.id), { status: created.status(), id: post?.id })
  const tC = Date.now(); const c1 = await get(`/blog/${slug}`); const c2 = await get('/blog')
  check('C publish invalidates the cached 404: article is public on the very next request', c1.status === 200 && c1.body.includes(T0), { status: c1.status, cache: c1.cache, ms: Date.now() - tC })
  check('C publish invalidates /blog: listing shows the new article on the next request', c2.body.includes(T0) && !listBefore.body.includes(T0), { cache: c2.cache, listingWasCachedBefore: listBefore.cache })

  // ---------- D. cache hits without CMS reads
  await delay(1500); await get(`/blog/${slug}`); await delay(1500); const n0 = reads().length; const hits: (string | undefined)[] = []
  for (let i = 0; i < 20; i++) hits.push((await get(`/blog/${slug}`)).cache)
  for (let i = 0; i < 20; i++) hits.push((await get('/blog')).cache)
  await delay(500); const n1 = reads().length
  check('D 40 repeated requests (article + listing) inside the interval are all HIT with zero CMS reads', hits.every(h => h === 'HIT') && n1 === n0, { hits: [...new Set(hits)], cmsReads: n1 - n0 })

  // ---------- E. timed 30-second revalidation (content changed WITHOUT invalidation)
  await get(`/blog/${slug}`); await get('/blog'); await delay(1500)
  const fresh = await get(`/blog/${slug}`); const tE = Date.now(); const nE = reads().length
  await payload.update({ collection: 'posts', id: post.id, context: { skipRevalidation: true }, data: { title: T1, _status: 'published' } })
  const timeline: unknown[] = []; let staleSeen = false, switchedAt = -1, oldServedAfterWrite = 0
  // The cache entry age is unknown to ±; sample every 5 s until the new title appears (max 80 s)
  while (Date.now() - tE < 80000) {
    const r = await get(`/blog/${slug}`); const sec = Math.round((Date.now() - tE) / 100) / 10; const hasNew = r.body.includes(T1)
    timeline.push({ sec, cache: r.cache, content: hasNew ? 'new' : 'old', cmsReadsSoFar: reads().length - nE })
    if (r.cache === 'STALE') staleSeen = true
    if (!hasNew) oldServedAfterWrite++
    if (hasNew) { switchedAt = sec; break }
    await delay(r.cache === 'STALE' ? 1000 : 5000)
  }
  info('E timeline after an un-invalidated published change', { cacheStateBeforeWrite: fresh.cache, timeline })
  const hitsOld = (timeline as { cache: string; content: string; cmsReadsSoFar: number; sec: number }[]).filter(x => x.cache === 'HIT' && x.content === 'old')
  check('E within the interval the old page is served from cache (HIT) with zero CMS reads', hitsOld.length >= 3 && hitsOld.every(x => x.cmsReadsSoFar === 0), { hitSamples: hitsOld.length, lastHitSec: hitsOld.at(-1)?.sec })
  check('E after ~30 s a request gets STALE and triggers regeneration; new content follows', staleSeen && switchedAt > 0 && switchedAt >= 25 && switchedAt <= 45, { staleSeen, newContentAtSec: switchedAt })
  const lE = await until(async () => (await get('/blog')).body.includes(T1), 45000); check('E /blog listing also picks up the change by timed revalidation', lE >= 0, { ms: lE })

  // ---------- F. draft saved through the admin UI stays private
  await page.goto(`/admin/collections/posts/${post.id}`); await page.locator('#field-title').waitFor()
  check('F admin edit screen opens the article with Lexical editor + table', await page.locator('#field-title').inputValue() === T1 && await page.locator('[contenteditable=true] table').count() > 0, { title: await page.locator('#field-title').inputValue() })
  const previewHref = await page.locator('a[href*="/preview/posts/"]').first().getAttribute('href').catch(() => null)
  check('F admin edit screen offers a Preview link to /preview/posts/<slug>', Boolean(previewHref?.includes(`/preview/posts/${slug}`)), previewHref)
  await page.locator('#field-title').fill(D1)
  const savedP = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/posts/${post.id}`)
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click(); const saved = await savedP
  check('F Save Draft in the admin UI succeeds', saved.ok() && new URL(saved.url()).searchParams.get('draft') === 'true', { status: saved.status(), draftParam: new URL(saved.url()).searchParams.get('draft') })
  await page.screenshot({ path: `${out}/admin-draft-saved.jpg`, type: 'jpeg', quality: 50 })
  const f1 = await get(`/blog/${slug}`); check('F public article unchanged immediately after draft save', f1.status === 200 && f1.body.includes(T1) && !f1.body.includes(D1), { cache: f1.cache })
  const apiDoc = await anon.get(`/api/posts/${post.id}`), apiDraft = await anon.get(`/api/posts/${post.id}?draft=true`), apiList = await anon.get(`/api/posts?draft=true&limit=100&depth=0`)
  const gql = await anon.post('/api/graphql', { data: { query: `{ Posts(draft:true, limit:100){ docs{ title _status } } }` } })
  const vers = await anon.get(`/api/posts/versions?limit=5`), prevAnon = await get(`/preview/posts/${slug}`)
  const leak = [await apiDoc.text(), await apiDraft.text(), await apiList.text(), await gql.text(), await vers.text(), prevAnon.body].map(t => t.includes(D1))
  check('F anonymous REST (plain, ?draft=true, list), GraphQL(draft:true), versions and /preview never expose the draft', leak.every(x => !x) && prevAnon.status === 404 && vers.status() === 403, { api: apiDoc.status(), apiDraft: apiDraft.status(), list: apiList.status(), graphql: gql.status(), versions: vers.status(), previewAnon: prevAnon.status, previewCacheControl: prevAnon.cc, leak })
  // G/J: force a timed regeneration WHILE a newer draft exists → regenerated page must still be the published version
  await delay(32000); const g1 = await get(`/blog/${slug}`); await delay(4000); const g2 = await get(`/blog/${slug}`); const g3 = await get('/blog')
  check('F timed regeneration while a draft exists still renders the published version (no draft leak)', !g1.body.includes(D1) && !g2.body.includes(D1) && g2.body.includes(T1) && !g3.body.includes(D1), { first: g1.cache, afterRegen: g2.cache })

  // ---------- G. authenticated preview is dynamic
  const pv = await page.goto(`/preview/posts/${slug}`); const pvH1 = await page.locator('h1').first().innerText()
  check('G authenticated preview shows the draft and is not cached', pvH1.includes(D1) && !pv!.headers()['x-nextjs-cache'] && /no-store/.test(pv!.headers()['cache-control'] || ''), { h1: pvH1, cacheControl: pv!.headers()['cache-control'], xNextjsCache: pv!.headers()['x-nextjs-cache'] ?? null })
  await page.screenshot({ path: `${out}/preview-draft.jpg`, type: 'jpeg', quality: 50 })
  const nP = reads().length; await ctx.request.get(`/preview/posts/${slug}`); await ctx.request.get(`/preview/posts/${slug}`)
  const loggedInPublic = await ctx.request.get(`/blog/${slug}`)
  check('G a logged-in editor requesting the PUBLIC url still gets the published version', !(await loggedInPublic.text()).includes(D1), { cache: loggedInPublic.headers()['x-nextjs-cache'] })
  void nP

  // ---------- H. publish through the admin UI → immediate public update
  await page.goto(`/admin/collections/posts/${post.id}`); await page.locator('#field-title').waitFor()
  check('H admin edit screen reloads with the saved draft', await page.locator('#field-title').inputValue() === D1)
  const pubP = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/posts/${post.id}`)
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click(); const pub = await pubP; const tH = Date.now()
  const h1 = await get(`/blog/${slug}`); const h2 = await get('/blog')
  check('H Publish in the admin UI succeeds', pub.ok(), { status: pub.status() })
  check('H published change is public on the next request (on-demand invalidation, no 30 s wait, no rebuild)', h1.body.includes(D1) && h2.body.includes(D1), { articleCache: h1.cache, listingCache: h2.cache, msAfterPublishResponse: Date.now() - tH })
  await delay(1500); const h3 = await get(`/blog/${slug}`); check('H regenerated page is cached again (HIT)', h3.cache === 'HIT' && h3.body.includes(D1), { cache: h3.cache })
  // restore original title through the UI
  await page.goto(`/admin/collections/posts/${post.id}`); await page.locator('#field-title').fill(T0)
  const resP = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/posts/${post.id}`)
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click(); await resP
  const h4 = await get(`/blog/${slug}`); check('H original content restored through the admin UI and public again', h4.body.includes(T0) && !h4.body.includes(D1), { cache: h4.cache })
  const after = await payload.findByID({ collection: 'posts', id: post.id, depth: 0 }); check('H table + content survive the UI round-trip', JSON.stringify(after.content).includes('"type":"table"') && JSON.stringify(after.content).length === JSON.stringify(source.content).length, { len: [JSON.stringify(after.content).length, JSON.stringify(source.content).length] })

  // ---------- I. slug rename, J. unpublish
  const renamed = `${slug}-renamed`; await get(`/blog/${renamed}`)
  const rn = await ctx.request.patch(`/api/posts/${post.id}`, { data: { slug: renamed, _status: 'published' } })
  const i1 = await get(`/blog/${slug}`), i2 = await get(`/blog/${renamed}`), i3 = await get('/blog')
  check('I slug change: old URL 404, new URL 200, listing links to new URL — all on next request', rn.ok() && i1.status === 404 && i2.status === 200 && i3.body.includes(`/blog/${renamed}`) && !i3.body.includes(`/blog/${slug}"`), { old: i1.status, renamed: i2.status })
  const un = await ctx.request.patch(`/api/posts/${post.id}`, { data: { _status: 'draft' } })
  const j1 = await get(`/blog/${renamed}`), j2 = await get('/blog'), j3 = await anon.get(`/api/posts/${post.id}`)
  check('J unpublish: article 404 publicly, removed from listing and anonymous API on next request', un.ok() && j1.status === 404 && !j2.body.includes(T0) && [403, 404].includes(j3.status()), { article: j1.status, api: j3.status() })
  const rp = await ctx.request.patch(`/api/posts/${post.id}`, { data: { slug, _status: 'published' } }); const j4 = await get(`/blog/${slug}`)
  check('J republish restores the article', rp.ok() && j4.status === 200, { status: j4.status })

  // ---------- K. website page fixture (template page): cache, draft, preview, publish
  const home = (await payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, depth: 0 })).docs[0]; const homeSnapshot = JSON.stringify(home)
  const sections = home.sections!.map(row => { const { id: _drop, ...copy } = row; void _drop; return copy })
  const pslug = `${run}-page`
  const pageDoc = await payload.create({ collection: 'pages', context: { skipRevalidation: true }, data: { title: `QA CLAUDY DISPOSABLE PAGE ${run}`, slug: pslug, template: 'home', sections, content: home.content!, _status: 'published' } }); owned.unshift({ collection: 'pages', id: pageDoc.id })
  const k1 = await get(`/${pslug}`); await delay(1500); const nK = reads().length; const k2 = await get(`/${pslug}`); const k2b = await get(`/${pslug}`); await delay(300)
  check('K page fixture: MISS then HIT, zero CMS reads on HIT', k1.status === 200 && k2.cache === 'HIT' && k2b.cache === 'HIT' && reads().length === nK, { first: k1.cache, then: k2.cache, cmsReads: reads().length - nK })
  const PD = `QA PAGE DRAFT ${run}`; const draftSections = sections.map((s, i) => i === 0 ? { ...s, heroHeading: PD } : s)
  const kd = await ctx.request.patch(`/api/pages/${pageDoc.id}?draft=true`, { data: { sections: draftSections, _status: 'draft' } })
  const k3 = await get(`/${pslug}`), k4 = await get(`/preview/${pslug}`); const k5 = await ctx.request.get(`/preview/${pslug}`); const k5t = await k5.text()
  check('K page draft: public unchanged, anonymous preview 404, authenticated preview shows draft uncached', kd.ok() && !k3.body.includes(PD) && k4.status === 404 && k5t.includes(PD) && /no-store/.test(k5.headers()['cache-control'] || ''), { public: k3.cache, previewAnon: k4.status, previewAuthCC: k5.headers()['cache-control'] })
  const kp = await ctx.request.patch(`/api/pages/${pageDoc.id}`, { data: { sections: draftSections, _status: 'published' } }); const k6 = await get(`/${pslug}`)
  check('K page publish: public page updated on next request', kp.ok() && k6.body.includes(PD), { cache: k6.cache })

  // ---------- L. disposable media upload: guards, R2 object, layout invalidation, cleanup through the app
  const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 30, b: 90 } } }).png().toBuffer()
  const priv = await ctx.request.post('/api/media', { multipart: { file: { name: 'qa.png', mimeType: 'image/png', buffer: png }, _payload: JSON.stringify({ alt: `QA CLAUDY disposable ${run}`, visibility: 'private' }) } })
  check('L private upload to the public R2 bucket is rejected', priv.status() === 400, { status: priv.status() })
  const bad = await ctx.request.post('/api/media', { multipart: { file: { name: 'qa.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }, _payload: JSON.stringify({ alt: 'QA svg', visibility: 'public' }) } })
  check('L SVG upload is rejected', bad.status() === 400, { status: bad.status() })
  await get('/seo-services'); await delay(1200); const l0 = await get('/seo-services')
  const up = await ctx.request.post('/api/media', { multipart: { file: { name: 'qa.png', mimeType: 'image/png', buffer: png }, _payload: JSON.stringify({ alt: `QA CLAUDY disposable ${run}`, visibility: 'public' }) } })
  const m = (await up.json()).doc; if (m?.id) owned.unshift({ collection: 'media', id: m.id })
  const l1 = await get('/seo-services')
  const thumbKey = m ? `${m.prefix}/${m.sizes?.thumbnail?.filename}` : ''
  const pubRes = m ? await fetch(m.url) : undefined; const pubBytes = pubRes ? Buffer.from(await pubRes.arrayBuffer()) : Buffer.alloc(0)
  check('L public upload stored in approved bucket under the base prefix, original + thumbnail, public bytes identical', up.status() === 201 && m.prefix === env.prefix && m.objectKey === `${env.prefix}/${m.filename}` && await objectExists(m.objectKey) && await objectExists(thumbKey) && pubRes!.status === 200 && pubBytes.equals(png) && new URL(m.url).origin === env.r2!.publicURL, { status: up.status(), prefix: m?.prefix, filenameRandomised: m?.filename !== 'qa.png', publicStatus: pubRes?.status })
  check('L media change invalidates the site layout cache (cached page regenerates on next request)', l0.cache === 'HIT' && l1.cache !== 'HIT' && l1.status === 200, { before: l0.cache, afterUpload: l1.cache })
  const anonDelMedia = m ? await anon.delete(`/api/media/${m.id}`) : undefined; const toPrivate = m ? await ctx.request.patch(`/api/media/${m.id}`, { data: { visibility: 'private' } }) : undefined
  check('L anonymous media delete denied; public→private change rejected', anonDelMedia?.status() === 403 && toPrivate?.status() === 400, { anonDelete: anonDelMedia?.status(), toPrivate: toPrivate?.status() })

  // ---------- M. access control
  const settingsNow = await (await anon.get('/api/globals/site-settings?depth=0')).json()
  const ac: Record<string, number> = {}
  ac['anon POST /api/posts'] = (await anon.post('/api/posts', { data: { title: 'x', slug: `${run}-denied`, _status: 'published' } })).status()
  ac['anon PATCH QA post'] = (await anon.patch(`/api/posts/${post.id}`, { data: { title: 'Denied' } })).status()
  ac['anon DELETE QA post'] = (await anon.delete(`/api/posts/${post.id}`)).status()
  ac['anon POST /api/pages'] = (await anon.post('/api/pages', { data: { title: 'x', slug: `${run}-denied` } })).status()
  ac['anon PATCH QA page'] = (await anon.patch(`/api/pages/${pageDoc.id}`, { data: { title: 'Denied' } })).status()
  ac['anon DELETE QA page'] = (await anon.delete(`/api/pages/${pageDoc.id}`)).status()
  ac['anon POST /api/media'] = (await anon.post('/api/media', { multipart: { file: { name: 'qa.png', mimeType: 'image/png', buffer: png }, _payload: JSON.stringify({ alt: 'denied', visibility: 'public' }) } })).status()
  ac['anon POST site-settings (same name)'] = (await anon.post('/api/globals/site-settings', { data: { websiteName: settingsNow.websiteName } })).status()
  ac['anon POST /api/users'] = (await anon.post('/api/users', { data: { email: `${run}-x@example.test`, password: randomBytes(24).toString('base64url'), role: 'admin' } })).status()
  ac['anon POST /api/users/first-register'] = (await anon.post('/api/users/first-register', { data: { email: `${run}-y@example.test`, password: randomBytes(24).toString('base64url'), role: 'admin' } })).status()
  ac['anon GET /api/users'] = (await anon.get('/api/users')).status()
  ac['anon GET /api/payload-preferences'] = (await anon.get('/api/payload-preferences')).status()
  ac['anon GET /api/posts/versions'] = (await anon.get('/api/posts/versions')).status()
  ac['anon GET /api/pages/versions'] = (await anon.get('/api/pages/versions')).status()
  ac['anon login wrong password (QA account)'] = (await anon.post('/api/users/login', { data: { email: editorEmail, password: 'wrong-' + randomBytes(8).toString('hex') } })).status()
  const me = await (await anon.get('/api/users/me')).json(); const gqlUsers = await (await anon.post('/api/graphql', { data: { query: '{ Users { docs { email } } }' } })).text()
  const gqlMut = await (await anon.post('/api/graphql', { data: { query: `mutation { updatePost(id:${post.id}, data:{title:"Denied"}){ title } }` } })).text()
  info('M anonymous status codes', ac)
  check('M all anonymous writes and private reads are denied (401/403)', Object.values(ac).every(s => s === 401 || s === 403), ac)
  check('M anonymous /api/users/me returns no user; GraphQL users query + post mutation denied', me.user === null && !gqlUsers.includes('@') && /forbidden|not allowed|unauthorized/i.test(gqlUsers) && /forbidden|not allowed|unauthorized/i.test(gqlMut), { me: me.user, gqlUsers: gqlUsers.slice(0, 120), gqlMut: gqlMut.slice(0, 120) })
  const stillT0 = await payload.findByID({ collection: 'posts', id: post.id, depth: 0 }); check('M denied writes changed nothing', stillT0.title === T0 && (await payload.count({ collection: 'users' })).totalDocs === usersBefore.length + 2)
  // editor role
  const ed = await request.newContext({ baseURL: T }); const login = await ed.post('/api/users/login', { data: { email: editorEmail, password: editorPw } }); const loginBody = await login.text()
  check('M editor REST login works; response has no hash/salt', login.ok() && !/"hash"|"salt"/.test(loginBody), { status: login.status() })
  const ec: Record<string, number> = {}
  ec['editor POST /api/users'] = (await ed.post('/api/users', { data: { email: `${run}-z@example.test`, password: randomBytes(24).toString('base64url'), role: 'admin' } })).status()
  ec['editor DELETE QA post'] = (await ed.delete(`/api/posts/${post.id}`)).status()
  ec['editor DELETE QA media'] = m ? (await ed.delete(`/api/media/${m.id}`)).status() : 0
  ec['editor PATCH other user'] = (await ed.patch(`/api/users/${admin.id}`, { data: { role: 'editor' } })).status()
  const selfEsc = await ed.patch(`/api/users/${editor.id}`, { data: { role: 'admin' } }); ec['editor PATCH own role→admin'] = selfEsc.status()
  const editorNow = await payload.findByID({ collection: 'users', id: editor.id, depth: 0 }); const edUsers = await (await ed.get('/api/users?limit=100')).json()
  const edDraft = await ed.patch(`/api/posts/${post.id}?draft=true`, { data: { title: `${T0} (editor draft)`, _status: 'draft' } }); const edPrev = await ed.get(`/preview/posts/${slug}`)
  check('M editor cannot create users, delete content, edit other users or escalate own role', [ec['editor POST /api/users'], ec['editor DELETE QA post'], ec['editor DELETE QA media'], ec['editor PATCH other user']].every(s => s === 403) && editorNow.role === 'editor' && selfEsc.status() === 403, ec)
  check('M editor sees only own user record; can save a draft and use preview', edUsers.docs.length === 1 && edUsers.docs[0].id === editor.id && edDraft.ok() && edPrev.status() === 200 && (await edPrev.text()).includes('(editor draft)'), { visibleUsers: edUsers.docs.length, draft: edDraft.status(), preview: edPrev.status() })
  const pubAfterEdDraft = await get(`/blog/${slug}`); check('M editor draft not public', !pubAfterEdDraft.body.includes('(editor draft)'))
  await ed.post('/api/users/logout'); await ed.dispose()
  // credential scan of everything fetched anonymously
  const secrets = ['PAYLOAD_SECRET', 'DATABASE_AUTH_TOKEN', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'].map(k => process.env[k]!).filter(Boolean); const apiHost = new URL(env.r2!.endpoint).hostname, dbHost = new URL(env.url).hostname
  const bodies: Record<string, string> = {}
  for (const p of ['/', '/blog', `/blog/${slug}`, '/contact', '/api/posts?depth=2&limit=3', '/api/pages?depth=2&limit=3', '/api/media?limit=5', '/api/globals/site-settings?depth=2', '/api/access', '/health/ready', '/admin/login']) bodies[p] = (await get(p)).body
  const hitsSecret = Object.entries(bodies).filter(([, b]) => secrets.some(s => b.includes(s)) || b.includes(apiHost) || b.includes(dbHost) || /"hash":|"salt":|resetPasswordToken/.test(b)).map(([p]) => p)
  check('M no credentials, DB host, R2 API endpoint or password fields in public pages / anonymous API responses', hitsSecret.length === 0, { scanned: Object.keys(bodies).length, hits: hitsSecret })

  // ---------- N. integrity of real content + cleanup through the application
  check('N imported article used as content source is byte-identical after QA', JSON.stringify((await payload.find({ collection: 'posts', where: { wordpressID: { equals: 9675 } }, depth: 0, limit: 1 })).docs[0]) === sourceSnapshot)
  check('N Home page is byte-identical after QA', JSON.stringify((await payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, depth: 0 })).docs[0]) === homeSnapshot)
  await get(`/blog/${slug}`); await get('/blog'); await get(`/${pslug}`)
  const delPost = await ctx.request.delete(`/api/posts/${post.id}`); const delPage = await ctx.request.delete(`/api/pages/${pageDoc.id}`); const delMedia = m ? await ctx.request.delete(`/api/media/${m.id}`) : undefined
  for (const [c, r] of [['posts', delPost], ['pages', delPage], ['media', delMedia]] as const) if (r?.ok()) owned.splice(owned.findIndex(o => o.collection === c), 1)
  const z1 = await get(`/blog/${slug}`), z2 = await get("/blog"), z3 = await get(`/${pslug}`)
  check('N admin delete through the app: fixtures gone publicly on the next request (delete invalidation)', delPost.ok() && delPage.ok() && z1.status === 404 && !z2.body.includes(run) && z3.status === 404, { article: z1.status, page: z3.status, listingCards: (z2.body.match(/<article/g) || []).length })
  if (m) { const gone = !(await objectExists(m.objectKey)) && !(await objectExists(thumbKey)); check('N disposable media deleted through the app: R2 original + thumbnail removed', Boolean(delMedia?.ok()) && gone, { status: delMedia?.status() }) }
  info('admin UI console/network issues', issues); info('external hosts requested by admin UI', [...externalHosts])
  check('B/H admin UI produced no console errors or failed requests', issues.length === 0, issues.slice(0, 8))
  check('admin UI made no third-party requests (e.g. Monaco CDN)', externalHosts.size === 0, [...externalHosts])
  await page.goto('/admin/logout').catch(() => {}); await ctx.close()
} catch (error) {
  check('UNEXPECTED ERROR — run aborted, cleanup follows', false, error instanceof Error ? scrub(error.message).slice(0, 800) : 'unknown')
  process.exitCode = 1
} finally {
  // owned-ID cleanup via Local API for anything left (users always go last)
  for (const doc of [...owned].sort((a, b) => Number(a.collection === 'users') - Number(b.collection === 'users'))) {
    try { await payload.delete({ collection: doc.collection, id: doc.id, context: { skipRevalidation: true } }) } catch (e) { check(`cleanup ${doc.collection}/${doc.id}`, false, e instanceof Error ? e.message : 'failed') }
  }
  const usersAfter = (await payload.find({ collection: 'users', limit: 100, depth: 0 })).docs.map(u => [u.id, u.email, u.role, u.updatedAt])
  const countsAfter = { posts: (await payload.count({ collection: 'posts' })).totalDocs, pages: (await payload.count({ collection: 'pages' })).totalDocs, media: (await payload.count({ collection: 'media' })).totalDocs }
  check('CLEANUP pre-existing users identical (id, email, role, updatedAt); no QA users remain', JSON.stringify(usersAfter) === JSON.stringify(usersBefore), { users: usersAfter.length })
  check('CLEANUP post/page/media counts back to baseline', JSON.stringify(countsAfter) === JSON.stringify(countsBefore), { countsBefore, countsAfter })
  await browser.close(); await anon.dispose(); s3.destroy(); await payload.destroy()
  writeFileSync(`${out}/results.json`, JSON.stringify({ run, fixtures: { articleSlug: slug, pageSlug: `${run}-page`, users: 'two temporary @example.test accounts, deleted' }, summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results }, null, 1).replaceAll(adminPw, '[pw]').replaceAll(editorPw, '[pw]'))
  console.log('SUMMARY', JSON.stringify({ pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }))
}
