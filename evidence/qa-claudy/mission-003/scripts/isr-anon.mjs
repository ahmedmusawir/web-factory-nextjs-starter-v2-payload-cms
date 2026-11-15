// Anonymous ISR behaviour against the production build. No writes.
import fs from 'node:fs'
const T = 'http://127.0.0.1:3001', LOG = process.argv[2], OUT = process.argv[3]
const reads = () => fs.readFileSync(LOG, 'utf8').split('\n').filter(l => l.includes('CMS_READ'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const get = async p => { const r = await fetch(T + p, { redirect: 'manual' }); const body = await r.text(); return { status: r.status, cache: r.headers.get('x-nextjs-cache'), cc: r.headers.get('cache-control'), len: body.length, body } }
const slugs = JSON.parse(fs.readFileSync('evidence/qa-claudy/mission-003/turso-before.json', 'utf8')).posts.map(p => p.slug)
const routes = ['/', '/seo-services', '/ppc', '/website-design', '/web-development', '/website-support', '/contact', '/blog', ...slugs.map(s => '/blog/' + s)]
const out = { routes: [] }
for (const route of routes) {
  const n0 = reads().length; const a = await get(route); await sleep(700); const n1 = reads().length
  const hits = []; for (let i = 0; i < 5; i++) hits.push((await get(route)).cache)
  await sleep(300); const n2 = reads().length
  const row = { route, status: a.status, first: a.cache, cacheControl: a.cc, bytes: a.len, readsOnFirst: n1 - n0, next5: hits.join(','), readsDuring5Repeats: n2 - n1 }
  out.routes.push(row); console.log(JSON.stringify(row))
}
// unknown slugs
out.notFound = []
for (const p of ['/qa-unknown-page-zz', '/blog/qa-unknown-article-zz', '/blog/', '/preview/home', '/preview/posts/' + slugs[0], '/content/posts/qa-unknown-zz']) {
  const a = await get(p); const b = await get(p); const row = { path: p, status: a.status, cache: a.cache, cc: a.cc, second: b.status, secondCache: b.cache, location: undefined }
  out.notFound.push(row); console.log(JSON.stringify(row))
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
