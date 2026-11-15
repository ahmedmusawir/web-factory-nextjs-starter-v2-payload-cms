// QA Mission 003 — smoke test of the container-equivalent standalone runtime (already running on argv[2]).
// One temporary admin + one disposable media item, both removed. No existing content is touched.
import '../../../../scripts/load-env'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { getPayload } from 'payload'
import sharp from 'sharp'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readEnvironment } from '../../../../cms/environment'

const env = readEnvironment()
assert.ok(env.kind === 'turso' && env.appEnv === 'test' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(new URL(env.url).hostname)); assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
const T = process.argv[2]; assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(T))
const run = `qa-claudy-m003-sa-${randomBytes(4).toString('hex')}`, email = `${run}@example.test`, pw = randomBytes(32).toString('base64url')
const { default: config } = await import('../../../../payload.config'); const payload = await getPayload({ config })
const out: Record<string, unknown> = { run }; let userId: number | undefined, mediaId: number | undefined
const usersBefore = (await payload.find({ collection: 'users', limit: 100, depth: 0 })).docs.map(u => [u.id, u.email, u.role, u.updatedAt])
const s3 = new S3Client({ region: 'auto', endpoint: env.r2!.endpoint, forcePathStyle: true, credentials: { accessKeyId: env.r2!.accessKeyId, secretAccessKey: env.r2!.secretAccessKey } })
const exists = async (Key: string) => { try { await s3.send(new HeadObjectCommand({ Bucket: env.r2!.bucket, Key })); return true } catch { return false } }
try {
  const slug = (await payload.find({ collection: 'posts', limit: 1, depth: 0, sort: '-publishedAt' })).docs[0].slug
  const routes: Record<string, unknown> = {}
  for (const p of ['/health/ready', '/', '/seo-services', '/blog', `/blog/${slug}`, '/admin/login', '/api/posts?limit=1&depth=0', '/api/graphql', '/cyberize/assets/Manrope.ttf', '/qa-missing', '/preview/home']) {
    const a = await fetch(T + p, { redirect: 'manual' }); await a.arrayBuffer(); const b = await fetch(T + p, { redirect: 'manual' }); await b.arrayBuffer()
    routes[p] = { status: a.status, cache: [a.headers.get('x-nextjs-cache'), b.headers.get('x-nextjs-cache')] }
  }
  out.routes = routes
  const home = await (await fetch(T + '/')).text(); const assets = [...new Set([...home.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map(m => m[1]))]
  out.staticAssets = { count: assets.length, non200: (await Promise.all(assets.map(async a => [a, (await fetch(T + a)).status] as const))).filter(([, s]) => s !== 200) }
  const user = await payload.create({ collection: 'users', context: { bootstrapAdmin: true }, data: { email, password: pw, role: 'admin' } }); userId = user.id
  const login = await fetch(T + '/api/users/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw }) })
  const cookie = login.headers.getSetCookie()[0] || ''; out.login = { status: login.status, cookieFlags: cookie.split(';').slice(1).map(s => s.trim().split('=')[0]) }
  const auth = { cookie: cookie.split(';')[0] }
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 20, g: 120, b: 200 } } }).png().toBuffer()
  const form = new FormData(); form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'qa.png'); form.append('_payload', JSON.stringify({ alt: `QA CLAUDY standalone disposable ${run}`, visibility: 'public' }))
  const up = await fetch(T + '/api/media', { method: 'POST', headers: auth, body: form }); const m = (await up.json()).doc; mediaId = m?.id
  const thumbKey = `${m?.prefix}/${m?.sizes?.thumbnail?.filename}`
  out.upload = { status: up.status, thumbnail: `${m?.sizes?.thumbnail?.width}x${m?.sizes?.thumbnail?.height}`, originalInR2: m ? await exists(m.objectKey) : false, thumbnailInR2: m ? await exists(thumbKey) : false, publicStatus: m ? (await fetch(m.url)).status : null }
  const admin = await fetch(T + '/admin/collections/posts', { headers: auth }); out.adminAuthenticated = { status: admin.status, bytes: (await admin.text()).length }
  const del = await fetch(T + `/api/media/${mediaId}`, { method: 'DELETE', headers: auth }); if (del.ok) { out.cleanupMedia = { status: del.status, objectsRemoved: !(await exists(m.objectKey)) && !(await exists(thumbKey)) }; mediaId = undefined }
  await fetch(T + '/api/users/logout', { method: 'POST', headers: auth })
  out.status = 'COMPLETED'
} catch (e) { out.status = 'ERROR'; out.error = e instanceof Error ? e.message.replaceAll(pw, '[pw]').slice(0, 500) : 'unknown'; process.exitCode = 1 }
finally {
  if (mediaId) await payload.delete({ collection: 'media', id: mediaId, context: { skipRevalidation: true } })
  if (userId) await payload.delete({ collection: 'users', id: userId })
  const usersAfter = (await payload.find({ collection: 'users', limit: 100, depth: 0 })).docs.map(u => [u.id, u.email, u.role, u.updatedAt])
  out.usersUnchanged = JSON.stringify(usersAfter) === JSON.stringify(usersBefore); out.mediaCount = (await payload.count({ collection: 'media' })).totalDocs
  s3.destroy(); await payload.destroy()
  writeFileSync('evidence/qa-claudy/mission-003/standalone/results.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1))
}
