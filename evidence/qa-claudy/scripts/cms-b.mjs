import fs from 'node:fs'
import path from 'node:path'
import { R, require, T, db, q, s3, sha, rec, results, login, state, env, S, creds } from './lib.mjs'
const { chromium, request } = require('@playwright/test')
const out = R + '/evidence/qa-claudy/cms'
const c = db(), store = s3(), issues = [], st = state.load()
const browser = await chromium.launch()
const anon = await request.newContext({ baseURL: T })
const homeAnon = async () => (await (await anon.get('/api/pages?where[slug][equals]=home&depth=2')).json()).docs[0]
const secrets = Object.entries({ DATABASE_AUTH_TOKEN: env.DATABASE_AUTH_TOKEN, PAYLOAD_SECRET: env.PAYLOAD_SECRET, R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY, R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID, R2_ENDPOINT_HOST: new URL(env.R2_ENDPOINT).hostname, DATABASE_HOST: new URL(env.DATABASE_URL).hostname, QA_PASSWORD: creds().password })
const leak = text => secrets.filter(([, v]) => v && text.includes(v)).map(([k]) => k)
try {
  // ---------- restart persistence
  const h = await homeAnon()
  rec('after restart: published heading persists (anonymous API)', h.sections[0].heroHeading === st.qaHeading ? 'PASS' : 'FAIL', h.sections[0].heroHeading)
  const pp = await browser.newPage({ viewport: { width: 1440, height: 900 } }); await pp.goto(T + '/'); const h1 = await pp.locator('h1').innerText()
  rec('after restart: public page renders published heading', h1.includes(st.qaHeading) ? 'PASS' : 'FAIL', h1.replace(/\n/g, ' / '))
  const heroSrc = await pp.locator('main img').first().getAttribute('src'); rec('after restart: hero image relationship renders from R2', heroSrc === h.sections[0].imgSrc1.url && heroSrc.startsWith(env.R2_PUBLIC_URL) ? 'PASS' : 'FAIL', heroSrc)
  await pp.screenshot({ path: `${out}/10-public-after-restart.png` }); await pp.close()
  const pa = await (await anon.get(`/api/posts?where[slug][equals]=${st.postSlug}&depth=1`)).json()
  rec('after restart: post→media relationship persists', pa.docs[0]?.featuredImage?.id === st.mediaId ? 'PASS' : 'FAIL')
  const pb = await fetch(st.mediaUrl); rec('after restart: R2 bytes identical', sha(Buffer.from(await pb.arrayBuffer())) === st.mediaSha ? 'PASS' : 'FAIL', pb.status)
  const gs = await (await anon.get('/api/globals/site-settings?depth=1')).json(); rec('after restart: settings + logo relationship persist', gs.websiteName === 'Cyberize Group' && gs.logo?.url?.startsWith(env.R2_PUBLIC_URL) ? 'PASS' : 'FAIL')
  const old = await request.newContext({ baseURL: T, storageState: S + 'auth.json' }); const me = await (await old.get('/api/users/me')).json()
  rec('after restart: existing session still valid (stable secret, Turso sessions)', me.user?.role === 'admin' ? 'PASS' : 'FAIL'); await old.dispose()
  const { ctx, page } = await login(browser, issues); const admin = ctx.request
  rec('after restart: fresh browser login works', 'PASS')
  // ---------- security: anonymous
  const tries = [
    ['PATCH', `/api/posts/${st.postId}`, { title: 'Denied' }], ['DELETE', `/api/posts/${st.postId}`], ['PATCH', `/api/pages/${st.pageId}`, {}], ['POST', '/api/pages', { title: 'Denied', slug: 'qa-denied' }],
    ['PATCH', `/api/media/${st.mediaId}`, { alt: 'Denied' }], ['DELETE', `/api/media/${st.mediaId}`], ['POST', '/api/globals/site-settings', {}],
    ['GET', '/api/users'], ['GET', '/api/users/1'], ['POST', '/api/users', { email: 'qa-denied@example.test', password: 'denied-denied-denied-1' }], ['POST', '/api/users/first-register', { email: 'qa-denied@example.test', password: 'denied-denied-denied-1' }],
    ['GET', '/api/payload-preferences'], ['GET', '/api/posts/versions'], ['GET', '/api/globals/site-settings/versions'], ['GET', '/api/payload-locked-documents'], ['GET', '/api/payload-migrations'], ['GET', '/api/payload-kv'],
  ]
  for (const [m, u, data] of tries) { const r = await anon.fetch(u, { method: m, data }); rec(`anonymous ${m} ${u} denied`, [401, 403, 404].includes(r.status()) ? 'PASS' : 'FAIL', r.status()) }
  const g1 = await anon.post('/api/graphql', { data: { query: '{ Users { docs { email } } }' } }); const g1t = await g1.text(); rec('anonymous GraphQL Users denied', /Forbidden|not allowed/.test(g1t) && !g1t.includes('@example.test') ? 'PASS' : 'FAIL', g1t.slice(0, 120))
  const g2 = await anon.post('/api/graphql', { data: { query: `mutation { updatePost(id:${st.postId}, data:{title:"Denied"}){ id } }` } }); rec('anonymous GraphQL mutation denied', /Forbidden|not allowed/.test(await g2.text()) ? 'PASS' : 'FAIL')
  const meAnon = await (await anon.get('/api/users/me')).json(); rec('anonymous /api/users/me has no user', meAnon.user == null ? 'PASS' : 'FAIL')
  const acc = await (await anon.get('/api/access')).json(); rec('anonymous /api/access canAccessAdmin false', acc.canAccessAdmin === false ? 'PASS' : 'FAIL')
  const bad = await anon.post('/api/users/login', { data: { email: creds().email, password: 'wrong-password-wrong-1' } }); rec('wrong password rejected', bad.status() === 401 ? 'PASS' : 'FAIL', bad.status())
  const still = await (await anon.get(`/api/posts/${st.postId}`)).json(); rec('disposable post unmodified after denied writes', still.title === 'QA Claudy disposable post' ? 'PASS' : 'FAIL')
  // draft post invisible
  const lex = still.content
  const dr = await admin.post('/api/posts', { data: { title: 'QA Claudy hidden draft', slug: st.postSlug + '-draft', content: lex, _status: 'draft' } }); const draft = (await dr.json()).doc; st.draftPostId = draft.id; state.save(st)
  const d1 = await anon.get(`/api/posts/${draft.id}`), d2 = await anon.get(`/api/posts/${draft.id}?draft=true`), d3 = await anon.get(`/content/posts/${st.postSlug}-draft`), d4 = await (await anon.get('/content')).text()
  rec('anonymous cannot read draft post (REST, draft flag, public route, listing)', [d1.status(), d2.status(), d3.status()].every(s => s === 404 || s === 403) && !d4.includes('hidden draft') ? 'PASS' : 'FAIL', [d1.status(), d2.status(), d3.status()])
  // media file route
  const mf = await anon.get(`/api/media/file/${path.basename(st.mediaKeys[0])}`, { maxRedirects: 0 }); rec('Payload media file route (anonymous, public record)', 'INFO', `${mf.status()} ${mf.headers()['location'] || mf.headers()['content-type'] || ''}`)
  // ---------- editor role
  const edPw = require('node:crypto').randomBytes(24).toString('base64url'), edEmail = `qa-claudy-editor-${Date.now().toString(36)}@example.test`
  const ec = await admin.post('/api/users', { data: { email: edEmail, password: edPw, role: 'editor' } }); const editor = (await ec.json()).doc; st.editorId = editor.id; state.save(st)
  rec('admin can create editor', ec.status() === 201 ? 'PASS' : 'FAIL', ec.status())
  const ed = await request.newContext({ baseURL: T }); const lg = await ed.post('/api/users/login', { data: { email: edEmail, password: edPw } })
  rec('editor login', lg.ok() ? 'PASS' : 'FAIL')
  const e1 = await ed.post('/api/users', { data: { email: 'qa-esc@example.test', password: 'denied-denied-denied-1', role: 'admin' } }); rec('editor cannot create users', e1.status() === 403 ? 'PASS' : 'FAIL', e1.status())
  const e2 = await ed.patch(`/api/users/${editor.id}`, { data: { role: 'admin' } }); const e2r = Number((await q(c, 'select count(*) n from users where id=? and role=?', [editor.id, 'editor']))[0].n); rec('editor cannot escalate own role', e2r === 1 ? 'PASS' : 'FAIL', e2.status())
  const e3 = await (await ed.get('/api/users')).json(); rec('editor sees only own user record', e3.docs?.length === 1 && e3.docs[0].id === editor.id ? 'PASS' : 'FAIL', e3.docs?.length)
  const e4 = await ed.delete(`/api/posts/${draft.id}`); rec('editor cannot delete content', e4.status() === 403 ? 'PASS' : 'FAIL', e4.status())
  const e5 = await ed.delete(`/api/media/${st.mediaId}`); rec('editor cannot delete media', e5.status() === 403 ? 'PASS' : 'FAIL', e5.status())
  const e6 = await ed.patch(`/api/posts/${draft.id}`, { data: { excerpt: 'editor edit' } }); rec('editor can edit content', e6.ok() ? 'PASS' : 'FAIL', e6.status())
  await ed.dispose()
  // ---------- credential scan
  let scanned = 0; const hits = []
  const scan = (name, text) => { scanned++; const l = leak(text); if (l.length) hits.push({ name, l }) }
  for (const u of ['/', '/seo-services', '/ppc', '/website-design', '/web-development', '/website-support', '/contact', '/content', '/missing-page', '/admin/login', '/api/globals/site-settings?depth=2', '/api/pages?depth=2&limit=50', '/api/media?limit=50', '/api/posts', '/api/access', '/api/users/me']) scan(u, await (await anon.get(u)).text())
  scan('rsc /', await (await anon.get('/', { headers: { rsc: '1' } })).text())
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
  const statics = walk(R + '/.next/static'); for (const f of statics) scan(f, fs.readFileSync(f, 'latin1'))
  // authenticated admin HTML too
  scan('admin dashboard (auth)', await (await admin.get('/admin')).text()); scan('admin page edit (auth)', await (await admin.get(`/admin/collections/pages/${st.pageId}`)).text())
  rec(`credential scan of ${scanned} responses/static files (${statics.length} static)`, hits.length ? 'FAIL' : 'PASS', hits)
  const usersJson = await (await admin.get('/api/users')).text(); rec('user API omits password hash/salt', /"hash"|"salt"/.test(usersJson) ? 'FAIL' : 'PASS')
  const hd = (await anon.get('/')).headers(); rec('response headers', 'INFO', { 'x-powered-by': hd['x-powered-by'], csp: hd['content-security-policy'] || null, xfo: hd['x-frame-options'] || null, xcto: hd['x-content-type-options'] || null })
  // ---------- restore heading through the admin UI
  await page.goto(`/admin/collections/pages/${st.pageId}`); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Show All', exact: true }).click()
  const field = page.locator('#field-sections__0__heroHeading')
  if ((await field.inputValue()) !== st.qaHeading) throw new Error('Concurrent editorial change detected; not overwriting')
  await field.fill(st.origHeading)
  const saved = page.waitForResponse(r => ['PATCH', 'POST'].includes(r.request().method()) && new URL(r.url()).pathname === `/api/pages/${st.pageId}`)
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click(); const sr = await saved
  const after = await homeAnon(); if (after.sections[0].heroHeading === st.origHeading) { st.headingChanged = false; state.save(st) }
  rec('original Home heading restored via admin UI and published', sr.ok() && after.sections[0].heroHeading === st.origHeading ? 'PASS' : 'FAIL', after.sections[0].heroHeading)
  // ---------- cleanup own fixtures through the application
  for (const [label, u, key] of [['draft post', `/api/posts/${st.draftPostId}`, 'draftPostId'], ['post', `/api/posts/${st.postId}`, 'postId'], ['editor', `/api/users/${st.editorId}`, 'editorId']]) { const r = await admin.delete(u); if (r.ok()) { delete st[key]; state.save(st) } rec(`delete disposable ${label} via Payload`, r.ok() ? 'PASS' : 'FAIL', r.status()) }
  await page.goto(`/admin/collections/media/${st.mediaId}`); await page.waitForLoadState('networkidle')
  const md = await admin.delete(`/api/media/${st.mediaId}`); rec('delete disposable media via Payload', md.ok() ? 'PASS' : 'FAIL', md.status())
  for (const k of st.mediaKeys) { const hd2 = await store.head(k); rec(`R2 object removed: ${k}`, hd2.exists ? 'FAIL' : 'PASS') }
  const objs = await store.list(env.R2_PREFIX + '/'); rec('R2: exactly the 24 website objects remain', objs.length === 24 && objs.every(o => o.key.startsWith(env.R2_PREFIX + '/web-factory-poc-site-1/')) ? 'PASS' : 'FAIL', objs.length)
  const gone = await fetch(st.mediaUrl + '?qa=' + Date.now()); rec('public URL of deleted object', 'INFO', gone.status)
  await ctx.storageState({ path: S + 'auth.json' }); await ctx.close()
} catch (e) { rec('UNEXPECTED ERROR', 'FAIL', String(e.stack || e).slice(0, 600)) }
rec('admin browser console/network issues', issues.filter(i => !i.includes('gravatar')).length ? 'INFO' : 'PASS', [...new Set(issues)])
fs.writeFileSync(out + '/results-phase-b.json', JSON.stringify(results(), null, 2))
await browser.close(); await anon.dispose(); store.close(); c.close()
