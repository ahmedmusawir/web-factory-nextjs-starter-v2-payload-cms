import { sanitizeWordPressHTML } from './wordpress-html'
import './load-env'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getPayload } from 'payload'
import { convertHTMLToLexical, sanitizeServerEditorConfig, defaultEditorConfig, EXPERIMENTAL_TableFeature } from '@payloadcms/richtext-lexical'
import { Window } from 'happy-dom'
import sanitize from 'sanitize-html'
import sharp from 'sharp'
import { readEnvironment } from '../cms/environment'

const env = readEnvironment()
if (env.kind === 'turso') {
 assert.ok(env.appEnv === 'test' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(new URL(env.url).hostname))
 assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
}
const { default: config } = await import('../payload.config')
const payload = await getPayload({ config })
const editorConfig = await sanitizeServerEditorConfig({ ...defaultEditorConfig, features: [...defaultEditorConfig.features!, EXPERIMENTAL_TableFeature()] }, payload.config)
class DOM {
 window: { document: Document }
 constructor(html: string) { const w = new Window({ settings: { enableJavaScriptEvaluation: false, disableCSSFileLoading: true, disableJavaScriptFileLoading: true } }); w.document.body.innerHTML = html; this.window = w as unknown as { document: Document } }
}
const plain = (html: string) => new DOM(sanitize(html, { allowedTags: [], allowedAttributes: {} })).window.document.body.textContent || ''
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
interface WP { id: number; slug: string; link: string; date_gmt: string; title: { rendered: string }; excerpt: { rendered: string }; content: { rendered: string }; yoast_head_json?: { title?: string; description?: string }; _embedded?: { 'wp:featuredmedia'?: { source_url: string; alt_text: string; caption: { rendered: string } }[]; 'wp:term'?: { taxonomy: string; name: string }[][] } }
const posts = (JSON.parse(readFileSync('evidence/mission-003/wordpress-source.json', 'utf8')) as WP[]).filter(p => p.content.rendered.length > 1000).slice(0, 12)
const report: { imported: string[]; skipped: string[]; media: { source: string; id: number; key: string | null | undefined }[] } = { imported: [], skipped: [], media: [] }
async function fetchImage(url: string) {
 const u = new URL(url); if (u.hostname === 'cyberizegroup.mystagingwebsite.com') u.hostname = 'cyberizegroup.com'
 assert.ok(u.protocol === 'https:' && u.hostname === 'cyberizegroup.com' && u.pathname.startsWith('/wp-content/uploads/'))
 const cached = `.data/wordpress-images/${digest(u.href)}`
 mkdirSync('.data/wordpress-images', { recursive: true })
 if (existsSync(cached)) return readFileSync(cached)
 for (let attempt = 0; ; attempt++) {
  try { const r = await fetch(u, { signal: AbortSignal.timeout(30000), redirect: 'error' }); assert.ok(r.ok, 'Image download failed'); assert.ok(Number(r.headers.get('content-length') || 0) <= 15000000); const bytes = Buffer.from(await r.arrayBuffer()); assert.ok(bytes.length <= 15000000); writeFileSync(cached, bytes); return bytes } catch (e) { if (attempt === 2) throw e; await new Promise(r => setTimeout(r, 700 * (attempt + 1))) }
 }
}
async function image(url: string, alt: string, caption = '') {
 const sourceID = `wordpress:media:${digest(url)}`
 let doc = (await payload.find({ collection: 'media', where: { sourceID: { equals: sourceID } }, limit: 1 })).docs[0]
 if (!doc) {
  let bytes = await fetchImage(url); const metadata = await sharp(bytes).metadata()
  assert.ok(['jpeg', 'png', 'webp'].includes(metadata.format || ''), 'Unsupported source image')
  let format = metadata.format!
  if (bytes.length > 3 * 1024 * 1024) { bytes = await sharp(bytes).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(); format = 'webp' }
  doc = await payload.create({ collection: 'media', context: { blogImport: true, skipRevalidation: true }, data: { sourceID, sourceDigest: digest(url), alt: alt || 'Article illustration', caption, visibility: 'public' }, file: { data: bytes, name: `wordpress.${format}`, mimetype: `image/${format}`, size: bytes.length } })
 }
 report.media.push({ source: url, id: doc.id, key: doc.objectKey }); return doc.id
}
try {
 // Check every collision before any writes; existing imported content is never overwritten.
 for (const post of posts) { const doc = (await payload.find({ collection: 'posts', where: { slug: { equals: post.slug } }, limit: 1 })).docs[0]; assert.ok(!doc || doc.sourceID === `wordpress:post:${post.id}`, 'Unrelated slug collision') }
 for (const post of posts) {
  const sourceID = `wordpress:post:${post.id}`
  if ((await payload.find({ collection: 'posts', where: { sourceID: { equals: sourceID } }, limit: 1 })).totalDocs) { report.skipped.push(post.link); continue }
  const featured = post._embedded?.['wp:featuredmedia']?.[0]
  const featuredImage = featured?.source_url ? await image(featured.source_url, featured.alt_text || plain(post.title.rendered), plain(featured.caption.rendered)) : undefined
  const html = sanitizeWordPressHTML(post.content.rendered)
  const dom = new DOM(html)
  for (const img of [...dom.window.document.querySelectorAll('img')]) {
   const id = await image(img.getAttribute('src')!, img.getAttribute('alt') || plain(post.title.rendered), img.closest('figure')?.querySelector('figcaption')?.textContent || '')
   img.setAttribute('data-lexical-upload-id', String(id)); img.setAttribute('data-lexical-upload-relation-to', 'media')
  }
  const content = convertHTMLToLexical({ editorConfig, html: dom.window.document.body.innerHTML, JSDOM: DOM })
  const normalize = (node: unknown): void => {
   if (!node || typeof node !== 'object') return
   if (Array.isArray(node)) { node.forEach(normalize); return }
   const item = node as Record<string, unknown>
   if (item.type === 'upload' && item.relationTo === 'media') item.value = Number(item.value)
   Object.values(item).forEach(normalize)
  }
  normalize(content)
  assert.ok(JSON.stringify(content).length > 1000, 'Empty conversion refused')
  await payload.create({ collection: 'posts', context: { skipRevalidation: true }, data: { sourceID, sourceDigest: digest(post.content.rendered), wordpressID: post.id, originalURL: post.link, title: plain(post.title.rendered), slug: post.slug, excerpt: plain(post.excerpt.rendered), content, featuredImage, publishedAt: `${post.date_gmt}Z`, categories: post._embedded?.['wp:term']?.flat().filter(t => t.taxonomy === 'category').map(t => plain(t.name)) || [], seoTitle: plain(post.yoast_head_json?.title || post.title.rendered).slice(0, 70), seoDescription: plain(post.yoast_head_json?.description || post.excerpt.rendered).slice(0, 170), _status: 'published' } })
  report.imported.push(post.link); writeFileSync('evidence/mission-003/import-results.json', JSON.stringify(report, null, 2)); console.log(`Imported ${report.imported.length}/12 articles`)
 }
 writeFileSync('evidence/mission-003/import-results.json', JSON.stringify(report, null, 2)); console.log(`Import complete: ${report.imported.length} created, ${report.skipped.length} preserved`)
} catch (error) { if (error && typeof error === 'object' && 'data' in error) console.error(JSON.stringify(error.data)); console.error('Import stopped:', error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[URL]') : 'unknown error'); process.exitCode = 1 }
finally { await payload.destroy() }
