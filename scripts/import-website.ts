import './load-env'
import { getPayload } from 'payload'
import sharp from 'sharp'
import path from 'node:path'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import raw from './fixtures/poc-content.json'
import type { Page, SiteSetting } from '../payload-types'
import { destination, fieldName, websiteStructure, type SectionData } from '../content/website'
import { readEnvironment } from '../cms/environment'

export const namespace = 'web-factory-poc-site-1'
export async function importWebsite() {
  const env = readEnvironment()
  if (env.kind === 'turso') {
    const host = new URL(env.url).hostname
    assert.ok(env.appEnv === 'test' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(host) && process.env.MIGRATION_TARGET_HOST === host && env.r2?.bucket === 'stark-web-factory-poc-media', 'Import is restricted to the approved POC resources')
  }
  const { default: config } = await import('../payload.config')
  const payload = await getPayload({ config })
  const groups: Record<string, Record<string, string>> = raw
  const sourceRoot = path.resolve('../web-factory-poc-site-1/public/cyberize/assets')
  const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
  const result: { created: string[]; skipped: string[]; conflicts: string[]; media: { source: string; id: number; key: string | null | undefined }[] } = { created: [], skipped: [], conflicts: [], media: [] }
  try {
    // Plan every page collision before uploading anything. Never overwrite an editor's page.
    for (const page of websiteStructure.pages) {
      const existing = await payload.find({ collection: 'pages', where: { slug: { equals: page.slug } }, limit: 1, overrideAccess: true })
      if (existing.docs[0] && existing.docs[0].sourceID !== `${namespace}:page:${page.slug}`) result.conflicts.push(page.slug)
    }
    const settings = await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })
    if ((settings.sourceID && settings.sourceID !== `${namespace}:settings`) || (!settings.sourceID && (settings.sections?.length || settings.websiteName !== 'Stark Web Factory'))) result.conflicts.push('site-settings contains existing editor content')
    assert.equal(result.conflicts.length, 0, 'Import conflicts require review; nothing has been written')
    const images = new Map<string, number>()
    const imageFields = Object.values(groups).flatMap(group => Object.entries(group).filter(([key]) => key.includes('.img_src_')).map(([key, value]) => ({ asset: value, alt: group[key.replace('img_src', 'img_alt')] })))
    for (const { asset, alt } of imageFields) {
      if (images.has(asset)) continue
      const name = path.basename(asset)
      assert.equal(asset, `assets/${name}`)
      const sourceID = `${namespace}:media:${name}`
      const existing = await payload.find({ collection: 'media', where: { sourceID: { equals: sourceID } }, limit: 1, overrideAccess: true })
      let media = existing.docs[0]
      if (media) result.skipped.push(sourceID)
      else {
        const source = readFileSync(path.join(sourceRoot, name))
        const bytes = name.endsWith('.svg') ? await sharp(source, { density: 144 }).resize({ width: 1200, withoutEnlargement: true }).png().toBuffer() : source
        assert.ok(bytes.length <= 3 * 1024 * 1024, 'Editorial asset exceeds upload limit')
        media = await payload.create({ collection: 'media', overrideAccess: true, context: { websiteImport: true }, data: { alt, visibility: 'public', sourceID, sourceDigest: hash(source) }, file: { data: bytes, name: name.replace(/\.svg$/, '.png'), mimetype: 'image/png', size: bytes.length } })
        result.created.push(sourceID)
      }
      images.set(asset, media.id)
      result.media.push({ source: name, id: media.id, key: media.objectKey })
    }
    const sectionRows = (keys: string[]): SectionData[] => keys.map(key => {
      const split = key.indexOf('.');const group = key.slice(0, split);const section = key.slice(split + 1)
      const row: SectionData = { key }
      for (const [source, value] of Object.entries(groups[group])) {
        if (!source.startsWith(section + '.')) continue
        const suffix = source.slice(section.length + 1)
        row[fieldName(suffix)] = suffix.startsWith('img_src_') ? images.get(value) : suffix.startsWith('a_href_') ? destination(value) : value
      }
      return row
    })
    for (const page of websiteStructure.pages) {
      const sourceID = `${namespace}:page:${page.slug}`
      if ((await payload.find({ collection: 'pages', where: { sourceID: { equals: sourceID } }, limit: 1, overrideAccess: true })).totalDocs) { result.skipped.push(sourceID); continue }
      await payload.create({ collection: 'pages', overrideAccess: true, data: { title: page.title.split(' — ')[0], slug: page.slug, template: page.slug as NonNullable<Page['template']>, sections: sectionRows(page.sections) as NonNullable<Page['sections']>, seoTitle: page.title, seoDescription: page.description, sourceID, sourceDigest: hash(JSON.stringify(groups[page.group])), _status: 'published', content: { root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0, children: [] } } } })
      result.created.push(sourceID)
    }
    if (!settings.sourceID) {
      await payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, data: { websiteName: 'Cyberize Group', websiteDescription: 'Website design and development, support and maintenance, SEO and PPC.', logo: images.get('assets/logo.png'), contact: groups.settings, contactProvisional: true, sourceID: `${namespace}:settings`, sections: sectionRows(['shared.header', 'shared.footer']) as NonNullable<SiteSetting['sections']> } })
      result.created.push(`${namespace}:settings`)
    } else result.skipped.push(`${namespace}:settings`)
    return result
  } finally { await payload.destroy() }
}
if (process.argv[1]?.endsWith('import-website.ts')) {
  const result = await importWebsite()
  const directory = process.env.ENGINEERING_EVIDENCE_DIR || 'evidence/mission-002'
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'import-result.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(`Website import: ${result.created.length} created, ${result.skipped.length} existing records preserved, ${result.conflicts.length} conflicts.`)
}
