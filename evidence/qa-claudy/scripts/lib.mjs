import fs from 'node:fs'
import { createRequire } from 'node:module'
export const R = '/home/moose/NEXTJS/NEXTJS_PAYLOAD_SQLITE_TEST/web-factory-nextjs-starter-v2-payload-cms'
export const require = createRequire(R + '/package.json')
export const env = Object.fromEntries(fs.readFileSync(R + '/.env.local', 'utf8').split('\n').filter(l => /^[A-Z0-9_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
export function db() {
  const { createClient } = require('@libsql/client')
  const host = new URL(env.DATABASE_URL).hostname
  if (!host.startsWith('web-factory-v2-poc-db-') || host !== env.DATABASE_TARGET_HOST) throw new Error('Not the approved POC database')
  return createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN })
}
// read-only guard
export async function q(c, sql, args = []) {
  if (!/^\s*(select|pragma table_info)/i.test(sql)) throw new Error('read-only only')
  return (await c.execute({ sql, args })).rows
}
import { createHash } from 'node:crypto'
export const sha = b => createHash('sha256').update(b).digest('hex')
export const T = 'http://127.0.0.1:3001'
export const S = new URL('.', import.meta.url).pathname
export const creds = () => JSON.parse(fs.readFileSync(S + 'creds.json', 'utf8'))
export const state = { load: () => fs.existsSync(S + 'state.json') ? JSON.parse(fs.readFileSync(S + 'state.json', 'utf8')) : {}, save: s => fs.writeFileSync(S + 'state.json', JSON.stringify(s, null, 1), { mode: 0o600 }) }
export function s3() {
  const { S3Client, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')
  if (env.R2_BUCKET !== 'stark-web-factory-poc-media') throw new Error('Not the approved bucket')
  const c = new S3Client({ region: 'auto', endpoint: env.R2_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } })
  return { // read-only helpers
    head: async Key => { try { const r = await c.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key })); return { exists: true, size: r.ContentLength, type: r.ContentType } } catch (e) { return { exists: false, err: e.name } } },
    list: async Prefix => { const r = await c.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, Prefix })); return (r.Contents || []).map(o => ({ key: o.Key, size: o.Size })) },
    close: () => c.destroy() }
}
const log = []
export const rec = (name, status, detail) => { log.push({ name, status, detail }); console.log(`${status}: ${name}${detail !== undefined ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`) }
export const results = () => log
export async function login(browser, issues) {
  const { email, password } = creds()
  const ctx = await browser.newContext({ baseURL: T, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage(); page.setDefaultTimeout(45000)
  page.on('console', m => { if (m.type() === 'error') issues.push(`${new URL(page.url()).pathname} console.error: ${m.text().slice(0, 250)}`) })
  page.on('pageerror', e => issues.push(`${new URL(page.url()).pathname} pageerror: ${String(e).slice(0, 250)}`))
  page.on('response', r => { if (r.status() >= 400) issues.push(`${new URL(page.url()).pathname} http ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`) })
  page.on('request', r => { const h = new URL(r.url()).host; if (!h.startsWith('127.0.0.1') && !h.endsWith('.r2.dev')) issues.push(`external request: ${h}`) })
  await page.goto('/admin/login')
  await page.locator('input[name="email"]').fill(email); await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /^log\s?in$/i }).click()
  await page.getByRole('link', { name: 'Pages', exact: true }).first().waitFor()
  return { ctx, page }
}
