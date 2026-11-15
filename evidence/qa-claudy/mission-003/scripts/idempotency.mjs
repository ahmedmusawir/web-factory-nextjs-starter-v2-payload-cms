// Non-destructive import idempotency check: replays the importer's decisions read-only (no writes, evidence untouched)
import fs from 'node:fs'
import { db, q, sha } from '../../scripts/lib.mjs'
const c = db()
const posts = JSON.parse(fs.readFileSync('evidence/mission-003/wordpress-source.json', 'utf8')).filter(p => p.content.rendered.length > 1000).slice(0, 12)
const out = { selected: posts.map(p => p.id), wouldSkip: [], wouldImport: [], slugCollisions: [] }
for (const p of posts) {
  const bySlug = await q(c, 'select source_i_d from posts where slug=?', [p.slug]); if (bySlug[0] && bySlug[0].source_i_d !== `wordpress:post:${p.id}`) out.slugCollisions.push(p.slug)
  const n = Number((await q(c, 'select count(*) n from posts where source_i_d=?', [`wordpress:post:${p.id}`]))[0].n); (n ? out.wouldSkip : out.wouldImport).push({ id: p.id, rows: n })
}
out.duplicatePostSourceIDs = await q(c, 'select source_i_d,count(*) n from posts group by source_i_d having n>1')
out.duplicateMediaSourceIDs = await q(c, 'select source_i_d,count(*) n from media where source_i_d is not null group by source_i_d having n>1')
out.mediaWithSourceID = Number((await q(c, "select count(*) n from media where source_i_d like 'wordpress:media:%'"))[0].n)
out.uniqueIndexes = (await q(c, "select name,tbl_name,sql from sqlite_master where type='index' and tbl_name in ('posts','media') and sql like '%UNIQUE%'")).map(r => r.name)
out.digestsCurrent = (await q(c, 'select wordpress_i_d,source_digest from posts')).every(r => r.source_digest === sha(posts.find(p => p.id === r.wordpress_i_d).content.rendered))
console.log(JSON.stringify({ ...out, wouldSkip: out.wouldSkip.length, wouldImport: out.wouldImport.length }, null, 1)); fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
