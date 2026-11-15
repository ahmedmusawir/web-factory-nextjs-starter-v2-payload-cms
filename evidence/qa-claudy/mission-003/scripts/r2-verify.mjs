// Read-only R2 verification: bucket listing vs Turso media rows vs public delivery bytes
import fs from 'node:fs'
import { db, q, s3, env, require, sha } from '../../scripts/lib.mjs'
const sharp = require('sharp')
const c = db(), r2 = s3()
const media = await q(c, 'select id,filename,mime_type,width,height,filesize,visibility,prefix,object_key,sizes_thumbnail_filename,sizes_thumbnail_filesize,sizes_thumbnail_width,sizes_thumbnail_height,sizes_thumbnail_mime_type from media order by id')
const objects = await r2.list('')
const byKey = Object.fromEntries(objects.map(o => [o.key, o.size]))
const expected = new Set(); const problems = []; const checks = []
const pub = env.R2_PUBLIC_URL.replace(/\/$/, '')
for (const m of media) {
  for (const [key, size, mime, w, h] of [[m.object_key, m.filesize, m.mime_type, m.width, m.height], [`${m.prefix}/${m.sizes_thumbnail_filename}`, m.sizes_thumbnail_filesize, m.sizes_thumbnail_mime_type, m.sizes_thumbnail_width, m.sizes_thumbnail_height]]) {
    expected.add(key)
    if (!(key in byKey)) { problems.push(`media ${m.id}: object missing ${key}`); continue }
    if (byKey[key] !== size) problems.push(`media ${m.id}: size ${byKey[key]} != db ${size} (${key})`)
    const res = await fetch(`${pub}/${key.split('/').map(encodeURIComponent).join('/')}`, { signal: AbortSignal.timeout(30000) })
    const bytes = Buffer.from(await res.arrayBuffer())
    let meta = {}; try { meta = await sharp(bytes).metadata() } catch (e) { problems.push(`media ${m.id}: undecodable ${key}`) }
    const ok = res.status === 200 && bytes.length === size && res.headers.get('content-type') === mime && meta.width === w && meta.height === h
    if (!ok) problems.push(`media ${m.id}: public ${res.status} len ${bytes.length}/${size} type ${res.headers.get('content-type')}/${mime} dims ${meta.width}x${meta.height}/${w}x${h} (${key})`)
    checks.push({ id: m.id, key, status: res.status, bytes: bytes.length, type: res.headers.get('content-type'), dims: `${meta.width}x${meta.height}`, sha256: sha(bytes) })
  }
  if (m.visibility !== 'public') problems.push(`media ${m.id} not public`)
}
const unexpected = objects.filter(o => !expected.has(o.key))
const byPrefix = {}; for (const o of objects) { const p = o.key.split('/').slice(0, -1).join('/'); byPrefix[p] = (byPrefix[p] || 0) + 1 }
const summary = { bucket: env.R2_BUCKET, mediaRows: media.length, objectsInBucket: objects.length, byPrefix, expectedKeys: expected.size, unexpectedObjects: unexpected.map(o => o.key), publicChecks: checks.length, publicOK: checks.filter(x => x.status === 200).length, problems }
fs.writeFileSync(process.argv[2], JSON.stringify({ summary, checks }, null, 1)); console.log(JSON.stringify(summary, null, 1)); r2.close()
