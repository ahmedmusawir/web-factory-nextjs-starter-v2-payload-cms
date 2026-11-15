// Compare live WordPress REST content with what is stored in Turso (read-only)
import fs from 'node:fs'
import { db, q, require, sha } from '../../scripts/lib.mjs'
const { Window } = require('happy-dom')
const wp = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const snap = JSON.parse(fs.readFileSync('evidence/mission-003/wordpress-source.json', 'utf8'))
const c = db()
const rows = await q(c, 'select * from posts order by wordpress_i_d')
const cats = await q(c, 'select parent_id,text,"order" from posts_texts order by parent_id,"order"')
const media = Object.fromEntries((await q(c, 'select id,filename,prefix,source_i_d,alt,width,height from media')).map(m => [m.id, m]))
const dom = html => { const w = new Window({ settings: { enableJavaScriptEvaluation: false, disableCSSFileLoading: true, disableJavaScriptFileLoading: true } }); w.document.body.innerHTML = html; return w.document }
const norm = s => s.normalize('NFKC').replace(/[\s ​]+/g, '')
const text = html => dom(html).body.textContent || ''
function walk(node, acc) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) return node.forEach(n => walk(n, acc))
  if (node.type) { const k = node.type === 'heading' ? node.tag : node.type; acc.types[k] = (acc.types[k] || 0) + 1 }
  if (node.type === 'text') acc.text += node.text
  if (node.type === 'link' || node.type === 'autolink') acc.links.push(node.fields?.url)
  if (node.type === 'upload') acc.uploads.push(node.value?.id ?? node.value)
  if (node.children) walk(node.children, acc)
}
const report = []
for (const row of rows) {
  const src = wp.find(p => p.id === row.wordpress_i_d); const s = snap.find(p => p.id === row.wordpress_i_d)
  const r = { wp: row.wordpress_i_d, slug: row.slug, issues: [] }
  if (!src) { r.issues.push('missing from live WP response'); report.push(r); continue }
  const d = dom(src.content.rendered)
  const cnt = sel => d.querySelectorAll(sel).length
  const acc = { types: {}, text: '', links: [], uploads: [] }; walk(JSON.parse(row.content).root, acc)
  const wpText = norm(d.body.textContent || ''), cmsText = norm(acc.text)
  r.liveEqualsSnapshot = s ? sha(s.content.rendered) === sha(src.content.rendered) : null
  r.sourceDigestMatchesLive = row.source_digest === sha(src.content.rendered)
  r.textChars = { wp: wpText.length, cms: cmsText.length, identical: wpText === cmsText }
  if (wpText !== cmsText) { let i = 0; while (i < wpText.length && wpText[i] === cmsText[i]) i++; r.firstDiff = { at: i, wp: wpText.slice(Math.max(0, i - 40), i + 60), cms: cmsText.slice(Math.max(0, i - 40), i + 60) } ; r.issues.push('body text differs') }
  const pairs = { h1: ['h1', 'h1'], h2: ['h2', 'h2'], h3: ['h3', 'h3'], h4: ['h4', 'h4'], li: ['li', 'listitem'], img: ['img', 'upload'], table: ['table', 'table'], blockquote: ['blockquote', 'quote'] }
  r.structure = {}
  for (const [k, [sel, t]] of Object.entries(pairs)) { const a = cnt(sel), b = acc.types[t] || 0; r.structure[k] = `${a}/${b}`; if (a !== b) r.issues.push(`${k}: wp ${a} vs cms ${b}`) }
  r.paragraphs = `${cnt('p')}/${acc.types.paragraph || 0}`
  const wpLinks = [...d.querySelectorAll('a[href]')].map(a => a.getAttribute('href')); r.links = `${wpLinks.length}/${acc.links.length}`
  const missingLinks = wpLinks.filter(h => !acc.links.includes(h)); if (wpLinks.length !== acc.links.length || missingLinks.length) r.issues.push(`links: wp ${wpLinks.length} vs cms ${acc.links.length}; hrefs not found: ${JSON.stringify(missingLinks.slice(0, 5))}`)
  r.linkHosts = [...new Set(acc.links.map(h => { try { return new URL(h).host } catch { return 'relative:' + h } }))]
  r.dropped = Object.fromEntries(['iframe', 'video', 'script', 'style', 'svg', 'form', 'div', 'span', 'figcaption', 'figure', 'a[target]', 'img[srcset]'].map(s2 => [s2, cnt(s2)]).filter(([, n]) => n))
  r.uploadsResolve = acc.uploads.every(id => media[id]?.prefix?.endsWith('/wordpress-blog')); if (!r.uploadsResolve) r.issues.push('inline upload does not resolve to blog media')
  const unresolvedImgs = (JSON.stringify(JSON.parse(row.content)).match(/cyberizegroup[^"]*wp-content[^"]*/g) || []); r.remainingWPImageRefs = unresolvedImgs.length
  // fields
  const t = text(src.title.rendered).trim(); if (t !== row.title) r.issues.push(`title: "${t}" vs "${row.title}"`)
  if (src.slug !== row.slug) r.issues.push('slug differs')
  if (src.date_gmt + 'Z' !== row.published_at) r.issues.push(`date: ${src.date_gmt} vs ${row.published_at}`)
  if (src.link !== row.original_u_r_l) r.issues.push('original URL differs')
  const wpCats = (src._embedded?.['wp:term'] || []).flat().filter(x => x.taxonomy === 'category').map(x => text(x.name)); const cmsCats = cats.filter(x => x.parent_id === row.id).map(x => x.text)
  r.categories = cmsCats; if (JSON.stringify(wpCats) !== JSON.stringify(cmsCats)) r.issues.push(`categories: ${wpCats} vs ${cmsCats}`)
  r.tagsInWP = (src._embedded?.['wp:term'] || []).flat().filter(x => x.taxonomy === 'post_tag').length
  const y = src.yoast_head_json || {}
  r.seo = { yoastTitle: y.title, cmsTitle: row.seo_title, titleExact: text(y.title || '') === row.seo_title, yoastDescPresent: Boolean(y.description), descExact: text(y.description || '') === row.seo_description, cmsDescLen: row.seo_description?.length }
  const f = src._embedded?.['wp:featuredmedia']?.[0]; const fm = media[row.featured_image_id]
  r.featured = { wp: f?.source_url, wpDims: f ? `${f.media_details?.width}x${f.media_details?.height}` : null, cms: fm ? `${fm.filename} ${fm.width}x${fm.height}` : null, sourceIDMatches: f && fm ? fm.source_i_d === 'wordpress:media:' + sha(f.source_url) : false, alt: fm?.alt, wpAlt: f?.alt_text }
  if (f && !r.featured.sourceIDMatches) r.issues.push('featured image mismatch')
  r.excerptExact = text(src.excerpt.rendered) === row.excerpt
  r.author = src._embedded?.author?.[0]?.name
  report.push(r)
}
fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 1))
for (const r of report) console.log(JSON.stringify(r))
