import fs from 'node:fs'
import { R, require, T, db, q, s3, sha, rec, results, login, state, env } from './lib.mjs'
const { chromium, request } = require('@playwright/test'); const sharp = require('sharp')
const out = R + '/evidence/qa-claudy/cms'; fs.mkdirSync(out, { recursive: true })
const c = db(), store = s3(), issues = [], st = state.load()
const browser = await chromium.launch()
const anon = await request.newContext({ baseURL: T })
const homeAnon = async () => (await (await anon.get('/api/pages?where[slug][equals]=home&depth=2')).json()).docs[0]
const publicH1 = async () => { const p = await browser.newPage(); await p.goto(T + '/'); const t = await p.locator('h1').innerText(); await p.close(); return t }
try {
  // anonymous admin
  const ap = await browser.newPage(); await ap.goto(T + '/admin'); await ap.waitForURL(/login/); rec('anonymous /admin redirects to login', 'PASS', new URL(ap.url()).pathname); await ap.close()
  const { ctx, page } = await login(browser, issues); const admin = ctx.request
  rec('admin login in Chromium', 'PASS'); await page.screenshot({ path: `${out}/01-dashboard.png` })
  for (const [name, url] of [['users', '/admin/collections/users'], ['pages', '/admin/collections/pages'], ['posts', '/admin/collections/posts'], ['media', '/admin/collections/media'], ['site-settings', '/admin/globals/site-settings']]) {
    const res = await page.goto(url); await page.waitForLoadState('networkidle')
    const rows = await page.locator('table tbody tr').count()
    const heading = (await page.locator('h1').first().innerText().catch(() => '')).trim()
    if (name !== 'users') await page.screenshot({ path: `${out}/02-${name}.png` })
    rec(`admin view: ${name}`, res.status() === 200 ? 'PASS' : 'FAIL', { status: res.status(), heading, rows })
  }
  // settings fields
  await page.goto('/admin/globals/site-settings'); await page.waitForLoadState('networkidle')
  rec('site settings shows stored name', (await page.locator('#field-websiteName').inputValue()) === 'Cyberize Group' ? 'PASS' : 'FAIL', await page.locator('#field-websiteName').inputValue())
  // ---------- draft/preview/publish
  const original = await homeAnon(); const origHeading = original.sections[0].heroHeading
 
  const qaHeading = `QA Claudy heading ${Date.now().toString(36)}`
  Object.assign(st, { pageId: original.id, origHeading, qaHeading, origUpdatedAt: original.updatedAt }); state.save(st)
  const h1Before = await publicH1()
  await page.goto(`/admin/collections/pages/${original.id}`); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Show All', exact: true }).click()
  const field = page.locator('#field-sections__0__heroHeading')
  rec('existing page opens with stored heading', (await field.inputValue()) === origHeading ? 'PASS' : 'FAIL', origHeading)
  await page.screenshot({ path: `${out}/03-home-edit.png` })
  await field.fill(qaHeading)
  let saved = page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === `/api/pages/${original.id}`)
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  const sr = await saved; st.headingChanged = true; state.save(st)
  rec('Save Draft', sr.ok() ? 'PASS' : 'FAIL', sr.status())
  const h1Draft = await publicH1()
  rec('public page unchanged while draft exists', h1Draft === h1Before && !h1Draft.includes(qaHeading) ? 'PASS' : 'FAIL', h1Draft.replace(/\n/g, ' / '))
  rec('anonymous REST published doc unchanged', (await homeAnon()).sections[0].heroHeading === origHeading ? 'PASS' : 'FAIL')
  for (const u of [`/api/pages/${original.id}?draft=true`, `/api/pages?draft=true&where[slug][equals]=home`, `/api/pages/versions?limit=5`, `/api/pages/${original.id}/versions`]) {
    const r = await anon.get(u); const body = await r.text()
    rec(`anonymous cannot read draft via ${u}`, body.includes(qaHeading) ? 'FAIL' : 'PASS', r.status())
  }
  const gq = await anon.post('/api/graphql', { data: { query: `{ Pages(draft:true, where:{slug:{equals:"home"}}){docs{ sections { heroHeading } }} versionsPages(limit:3){docs{ id }} }` } })
  const gqb = await gq.text(); rec('anonymous GraphQL does not expose draft', gqb.includes(qaHeading) ? 'FAIL' : 'PASS', `${gq.status()} ${gqb.slice(0, 160)}`)
  const ap2 = await anon.get('/preview/home'); rec('anonymous /preview/home denied', ap2.status() === 404 && !(await ap2.text()).includes(qaHeading) ? 'PASS' : 'FAIL', ap2.status())
  // preview via admin Preview control
  const previewLink = page.locator('a[href*="/preview/home"], button:has-text("Preview")').first()
  rec('admin Preview control present', await previewLink.count() ? 'PASS' : 'FAIL', await previewLink.evaluate(e => e.tagName + ' ' + (e.getAttribute('href') || e.textContent)).catch(() => 'none'))
  const pv = await ctx.newPage(); const pr = await pv.goto('/preview/home'); const pvh = await pv.locator('h1').innerText()
  rec('authorized preview shows draft heading', pr.status() === 200 && pvh.includes(qaHeading) ? 'PASS' : 'FAIL', pvh.replace(/\n/g, ' / '))
  await pv.screenshot({ path: `${out}/04-preview-draft.png` }); await pv.close()
  const pubShot = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await pubShot.goto(T + '/'); await pubShot.screenshot({ path: `${out}/05-public-during-draft.png` })
  const row = await q(c, 'select p.updated_at, s.hero_heading from pages p join pages_sections s on s._parent_id=p.id where p.id=? and s._order=1', [original.id])
  const vrow = await q(c, 'select v.id, v.version__status st, s.hero_heading from _pages_v v join _pages_v_version_sections s on s._parent_id=v.id where v.parent_id=? and s._order=1 order by v.id desc limit 1', [original.id])
  rec('Turso: published row keeps original, latest version row holds draft', row[0].hero_heading === origHeading && vrow[0].hero_heading === qaHeading && vrow[0].st === 'draft' ? 'PASS' : 'FAIL', { published: row[0].hero_heading, latestVersion: vrow[0] })
  // publish
  await page.goto(`/admin/collections/pages/${original.id}`); await page.waitForLoadState('networkidle')
  saved = page.waitForResponse(r => ['PATCH', 'POST'].includes(r.request().method()) && new URL(r.url()).pathname === `/api/pages/${original.id}`)
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click(); const pubr = await saved
  rec('Publish changes', pubr.ok() ? 'PASS' : 'FAIL', pubr.status())
  await pubShot.reload(); const h1Pub = await pubShot.locator('h1').innerText()
  rec('public page shows published heading without rebuild', h1Pub.includes(qaHeading) ? 'PASS' : 'FAIL', h1Pub.replace(/\n/g, ' / '))
  await pubShot.screenshot({ path: `${out}/06-public-after-publish.png` }); await pubShot.close()
  const row2 = await q(c, 'select s.hero_heading from pages_sections s where s._parent_id=? and s._order=1', [original.id])
  rec('Turso: published row now holds new heading', row2[0].hero_heading === qaHeading ? 'PASS' : 'FAIL')
  // ---------- R2 upload through admin UI
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#1565c0' } }).png().toBuffer()
  const before = await store.list(env.R2_PREFIX + '/'); st.objectsBefore = before.length; state.save(st)
  rec('R2 objects before upload', before.length === 24 ? 'PASS' : 'FAIL', before.length)
  const anonUp = await anon.post('/api/media', { multipart: { file: { name: 'qa-anon.png', mimeType: 'image/png', buffer: png }, _payload: JSON.stringify({ alt: 'QA denied', visibility: 'public' }) } })
  rec('anonymous upload denied', [401, 403].includes(anonUp.status()) ? 'PASS' : 'FAIL', anonUp.status())
  const privUp = await admin.post('/api/media', { multipart: { file: { name: 'qa-private.png', mimeType: 'image/png', buffer: png }, _payload: JSON.stringify({ alt: 'QA private rejected', visibility: 'private' }) } })
  rec('private upload to public bucket rejected', privUp.status() === 400 ? 'PASS' : 'FAIL', privUp.status())
  const mid = await store.list(env.R2_PREFIX + '/'); rec('denied/rejected uploads created no R2 objects or rows', mid.length === 24 && Number((await q(c, 'select count(*) n from media'))[0].n) === 12 ? 'PASS' : 'FAIL', mid.length)
  await page.goto('/admin/collections/media/create'); await page.waitForLoadState('networkidle')
  await page.locator('input[type="file"]').setInputFiles({ name: 'qa-claudy-disposable.png', mimeType: 'image/png', buffer: png })
  const alt = `QA Claudy disposable ${Date.now().toString(36)}`
  await page.locator('#field-alt').fill(alt)
  await page.locator('#field-visibility').click(); await page.getByText('public', { exact: true }).last().click()
  const up = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/media')
  await page.getByRole('button', { name: 'Save', exact: true }).click(); const upr = await up
  const doc = (await upr.json()).doc; st.mediaId = doc?.id; st.mediaAlt = alt; st.mediaKeys = doc ? [doc.objectKey, `${doc.prefix}/${doc.sizes.thumbnail.filename}`] : []; st.mediaUrl = doc?.url; st.mediaSha = sha(png); state.save(st)
  rec('upload disposable image through Payload admin UI', upr.status() === 201 ? 'PASS' : 'FAIL', { status: upr.status(), id: doc?.id, objectKey: doc?.objectKey })
  await page.waitForLoadState('networkidle'); await page.screenshot({ path: `${out}/07-media-uploaded.png` })
  for (const k of st.mediaKeys) { const h = await store.head(k); rec(`R2 object exists: ${k}`, h.exists ? 'PASS' : 'FAIL', h) }
  const mrow = await q(c, 'select id,alt,visibility,prefix,object_key,filename,mime_type,width,height,filesize,url,sizes_thumbnail_filename from media where id=?', [doc.id])
  rec('Turso media metadata row', mrow.length === 1 && mrow[0].object_key === doc.objectKey && mrow[0].width === 800 && mrow[0].filesize === png.length ? 'PASS' : 'FAIL', mrow[0])
  const pubRes = await fetch(doc.url); const pubBytes = Buffer.from(await pubRes.arrayBuffer())
  rec('public r2.dev delivery returns identical bytes', pubRes.status === 200 && sha(pubBytes) === sha(png) && new URL(doc.url).origin === env.R2_PUBLIC_URL ? 'PASS' : 'FAIL', { status: pubRes.status, type: pubRes.headers.get('content-type') })
  const th = await fetch(doc.sizes.thumbnail.url); rec('public thumbnail delivery', th.status === 200 ? 'PASS' : 'FAIL', th.status)
  rec('new bytes not written to local media dirs', !fs.existsSync(R + '/.data/test/media/' + doc.filename) && !fs.existsSync(R + '/.data/local/media/' + doc.filename) ? 'PASS' : 'FAIL')
  const toPriv = await admin.patch(`/api/media/${doc.id}`, { data: { visibility: 'private' } }); rec('public→private change rejected', toPriv.status() === 400 ? 'PASS' : 'FAIL', toPriv.status())
  const spoof = await admin.patch(`/api/media/${doc.id}`, { data: { prefix: 'attacker', objectKey: 'attacker/x.png' } }); const sp = (await spoof.json()).doc
  rec('client cannot rewrite objectKey/prefix', sp?.objectKey === doc.objectKey && sp?.prefix === doc.prefix ? 'PASS' : 'FAIL', spoof.status())
  // relationship: disposable post with featured image
  const slug = `qa-claudy-${Date.now().toString(36)}`
  const lex = { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '', children: [{ type: 'text', text: 'QA disposable post body.', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }] } }
  const pr2 = await admin.post('/api/posts', { data: { title: 'QA Claudy disposable post', slug, content: lex, featuredImage: doc.id, _status: 'published' } })
  const post = (await pr2.json()).doc; st.postId = post?.id; st.postSlug = slug; state.save(st)
  rec('create published disposable post with image relationship', pr2.status() === 201 ? 'PASS' : 'FAIL', pr2.status())
  const prow = await q(c, 'select featured_image_id, _status from posts where id=?', [post.id]); rec('Turso: post→media relationship stored', Number(prow[0].featured_image_id) === doc.id ? 'PASS' : 'FAIL', prow[0])
  const pa = await (await anon.get(`/api/posts?where[slug][equals]=${slug}&depth=1`)).json(); rec('anonymous read resolves post→media relationship', pa.docs[0]?.featuredImage?.url === doc.url ? 'PASS' : 'FAIL')
  await page.goto(`/admin/collections/posts/${post.id}`); await page.waitForLoadState('networkidle'); await page.screenshot({ path: `${out}/08-post-with-image.png` })
  const pp = await browser.newPage(); const ppr = await pp.goto(`${T}/content/posts/${slug}`); rec('public post detail route', ppr.status() === 200 ? 'PASS' : 'FAIL', ppr.status()); const lp = await pp.goto(`${T}/content`); rec('/content lists published post', (await pp.locator('body').innerText()).includes('QA Claudy disposable post') ? 'PASS' : 'FAIL', lp.status()); await pp.screenshot({ path: `${out}/09-content-list.png` }); await pp.close()
  // also use the new image in a Home page DRAFT via relationship? (kept to post only to avoid touching site content)
  await ctx.storageState({ path: new URL('./auth.json', import.meta.url).pathname }); await ctx.close()
} catch (e) { rec('UNEXPECTED ERROR', 'FAIL', String(e.stack || e).slice(0, 600)) }
rec('admin browser console/network issues', issues.length ? 'INFO' : 'PASS', issues)
fs.writeFileSync(out + '/results-phase-a.json', JSON.stringify(results(), null, 2))
await browser.close(); await anon.dispose(); store.close(); c.close()
