// Read-only Turso inspection (SELECT / pragma only, guarded to approved POC DB)
import fs from 'node:fs'
import { db, q, sha } from '../../scripts/lib.mjs'
const c = db(); const out = {}
const tables = (await q(c, "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name")).map(r => r.name)
out.counts = {}; for (const t of tables) out.counts[t] = Number((await q(c, `select count(*) n from "${t}"`))[0].n)
out.migrations = await q(c, 'select name,batch from payload_migrations order by id')
// user fingerprint: no email/hash disclosed, only digests for before/after comparison
out.users = (await q(c, 'select * from users order by id')).map(u => ({ id: u.id, role: u.role, created_at: u.created_at, updated_at: u.updated_at, emailDomainTest: String(u.email).endsWith('@example.test'), fingerprint: sha(JSON.stringify([u.email, u.hash, u.salt, u.role])) }))
out.postCols = (await q(c, 'pragma table_info(posts)')).map(r => r.name)
out.posts = await q(c, 'select id,title,slug,_status,published_at,wordpress_i_d,source_i_d,original_u_r_l,featured_image_id,seo_title,seo_description,length(content) content_len,length(excerpt) excerpt_len,updated_at,created_at from posts order by wordpress_i_d')
out.pages = await q(c, 'select id,slug,title,template,_status,updated_at from pages order by id')
out.mediaByPrefix = await q(c, 'select prefix,count(*) n,sum(filesize) bytes,sum(case when sizes_thumbnail_filename is not null then 1 else 0 end) thumbs,sum(case when visibility=\'public\' then 1 else 0 end) pub from media group by prefix')
out.media = await q(c, 'select id,filename,mime_type,width,height,filesize,visibility,prefix,object_key,sizes_thumbnail_filename,sizes_thumbnail_filesize,source_i_d,alt from media order by id')
out.versions = await q(c, 'select parent_id,count(*) n,sum(case when version__status=\'draft\' then 1 else 0 end) drafts from _posts_v group by parent_id')
out.latestDrafts = await q(c, 'select id,parent_id,version_title,version__status,latest,updated_at from _posts_v where latest=1 order by parent_id')
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
console.log(JSON.stringify({ counts: out.counts, migrations: out.migrations, users: out.users, mediaByPrefix: out.mediaByPrefix, pages: out.pages }, null, 1))
console.log(out.postCols.join(','))
for (const p of out.posts) console.log(JSON.stringify(p))
console.log('versions', JSON.stringify(out.versions)); console.log('latest', JSON.stringify(out.latestDrafts))
