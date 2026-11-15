import fs from 'node:fs'
import { R, require, T, db, q, s3, rec, results, state, env, S } from './lib.mjs'
const { request, chromium } = require('@playwright/test')
const c = db(), store = s3(), st = state.load()
if (st.headingChanged || st.postId || st.draftPostId || st.editorId) throw new Error('Fixtures remain; not deleting admin: ' + JSON.stringify(st))
const admin = await request.newContext({ baseURL: T, storageState: S + 'auth.json' })
const me = (await (await admin.get('/api/users/me')).json()).user
const users = await q(c, 'select id,email from users')
if (users.length !== 1 || users[0].id !== me.id || !String(users[0].email).startsWith('qa-claudy-')) throw new Error('Unexpected users; not deleting')
const del = await admin.delete(`/api/users/${me.id}`); rec('delete disposable QA administrator via Payload', del.ok() ? 'PASS' : 'FAIL', del.status())
const after = await admin.get('/api/users/me'); rec('deleted admin session no longer authenticates', (await after.json()).user == null ? 'PASS' : 'FAIL'); await admin.dispose()
const n = async t => Number((await q(c, `select count(*) n from "${t}"`))[0].n)
const inv = {}; for (const t of ['users', 'users_sessions', 'pages', 'pages_sections', '_pages_v', 'posts', '_posts_v', 'media', 'site_settings', 'site_settings_sections', 'payload_migrations', 'payload_locked_documents', 'payload_preferences']) inv[t] = await n(t)
rec('final Turso inventory', inv.users === 0 && inv.users_sessions === 0 && inv.pages === 7 && inv.pages_sections === 32 && inv.media === 12 && inv.posts === 0 && inv._posts_v === 0 && inv.payload_migrations === 2 ? 'PASS' : 'FAIL', inv)
rec('all 7 pages published in Turso', Number((await q(c, "select count(*) n from pages where _status='published'"))[0].n) === 7 ? 'PASS' : 'FAIL')
const objs = await store.list(env.R2_PREFIX + '/'); rec('final R2 object count under prefix', objs.length === 24 ? 'PASS' : 'FAIL', objs.length)
const b = await chromium.launch(); const texts = []
for (const o of ['http://127.0.0.1:3002', T]) { const p = await b.newPage(); await p.goto(o + '/'); texts.push(await p.locator('body').innerText()); await p.close() }
rec('restored Home text identical to reference', texts[0] === texts[1] ? 'PASS' : 'FAIL'); await b.close()
fs.writeFileSync(R + '/evidence/qa-claudy/cms/results-final-cleanup.json', JSON.stringify(results(), null, 2))
for (const f of ['creds.json', 'auth.json']) fs.rmSync(S + f, { force: true })
store.close(); c.close()
