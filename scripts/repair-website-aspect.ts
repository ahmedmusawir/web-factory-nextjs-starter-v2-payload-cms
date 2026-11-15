import './load-env'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import sharp from 'sharp'
import { readEnvironment } from '../cms/environment'

// One-time correction of this mission's initial rasterization only. Never overwrites editor bytes.
assert.ok(process.argv.includes('--approved-aspect-correction'))
const env = readEnvironment()
assert.ok(env.appEnv === 'test' && env.kind === 'turso' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(new URL(env.url).hostname))
assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
const { default: config } = await import('../payload.config')
const payload = await getPayload({ config })
const results: unknown[] = []
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
try {
  assert.equal((await payload.count({ collection: 'users' })).totalDocs, 0, 'No concurrent operator edits allowed')
  const docs = (await payload.find({ collection: 'media', limit: 100, where: { sourceID: { contains: 'web-factory-poc-site-1:media:' } } })).docs
  const planned = []
  for (const doc of docs) {
    const name = doc.sourceID!.split(':').at(-1)!
    if (!name.endsWith('.svg')) continue
    assert.equal(name, path.basename(name))
    const source = readFileSync(path.join('../web-factory-poc-site-1/public/cyberize/assets', name))
    assert.equal(hash(source), doc.sourceDigest)
    const previous = await sharp(source, { density: 144 }).resize({ width: 1600, withoutEnlargement: true }).png().toBuffer()
    const corrected = await sharp(source, { density: 144 }).resize({ width: 1200, withoutEnlargement: true }).png().toBuffer()
    const current = Buffer.from(await (await fetch(doc.url!)).arrayBuffer())
    if (hash(current) === hash(corrected)) continue
    assert.equal(hash(current), hash(previous), 'Editor changed image: stop without overwriting it')
    planned.push({ doc, corrected })
  }
  for (const { doc, corrected } of planned) {
    const updated = await payload.update({ collection: 'media', id: doc.id, overrideAccess: true, data: { alt: doc.alt, visibility: 'public' }, file: { data: corrected, name: 'reference-aspect.png', mimetype: 'image/png', size: corrected.length } })
    results.push({ id: doc.id, sourceID: doc.sourceID, previousKey: doc.objectKey, key: updated.objectKey, width: updated.width, height: updated.height })
    writeFileSync('evidence/mission-002/aspect-correction.json', JSON.stringify(results, null, 2) + '\n')
  }
  console.log(`PASS: ${results.length} imported raster images corrected to exact source aspect ratios; relationships preserved.`)
} catch { console.error('Aspect correction stopped; inspect recorded progress before retry.'); process.exitCode = 1 }
finally { await payload.destroy() }
