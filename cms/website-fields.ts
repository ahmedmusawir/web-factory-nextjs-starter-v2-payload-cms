import type { Field } from 'payload'
import { fieldName, websiteStructure, safeEditorialLink } from '../content/website'

const definitions: Record<string, string[]> = websiteStructure.sections
const label = (key: string) => {
  if (key === 'h1_text_1') return 'Hero heading'
  const [tag, kind, number] = key.split('_')
  const names: Record<string, string> = { p: 'Paragraph', h2: 'Section heading', h3: 'Card heading', br: 'Line continuation', span: 'Accent / label', strong: 'Emphasis', summary: 'FAQ question', pre: 'Code illustration text', small: 'Small label', div: 'Panel label', b: 'Bold label', i: 'Symbol', em: 'Accent', button: 'Button label' }
  return `${tag === 'img' ? kind === 'src' ? 'Image' : 'Image alt text' : tag === 'a' ? kind === 'href' ? 'Link URL' : 'Link label' : names[tag] || tag} ${number}`
}
export function websiteSections(global = false): Field {
  const keys = Object.keys(definitions).filter(key => global === key.startsWith('shared.'))
  const fields = [...new Set(keys.flatMap(key => definitions[key]))]
  return {
    name: 'sections', type: 'array', label: global ? 'Navigation and footer' : 'Website sections',
    admin: { isSortable: false, initCollapsed: true, description: 'Fixed sections from the approved website. Edit their content; the design and section order stay in code.' },
    fields: [
      { name: 'key', type: 'select', required: true, options: keys.map(value => ({ label: value.replaceAll(/[.-]/g, ' '), value })), admin: { readOnly: true } },
      ...fields.map((source): Field => {
        const admin = { condition: (_: unknown, sibling: Record<string, unknown>) => definitions[String(sibling.key)]?.includes(source) || false }
        if (source.startsWith('img_src_')) return { name: fieldName(source), label: label(source), type: 'upload', relationTo: 'media', filterOptions: { visibility: { equals: 'public' } }, admin }
        if (source.startsWith('p_text') || source.startsWith('pre_text')) return { name: fieldName(source), label: label(source), type: 'textarea', admin }
        return { name: fieldName(source), label: label(source), type: 'text', admin,
          ...(source.startsWith('a_href') ? { validate: (value: unknown) => safeEditorialLink(value) || 'Use a relative path, anchor, HTTPS, mailto or tel link.' } : {}) }
      }),
    ],
  }
}
export const sourceFields: Field[] = [
  { name: 'sourceID', type: 'text', unique: true, index: true, admin: { readOnly: true, position: 'sidebar' }, access: { create: () => false, update: () => false } },
  { name: 'sourceDigest', type: 'text', admin: { hidden: true }, access: { create: () => false, update: () => false } },
]
export const websitePageFields: Field[] = [
  ...sourceFields,
  { name: 'template', type: 'select', options: websiteStructure.pages.map(page => ({ label: page.slug, value: page.slug })), admin: { readOnly: true, position: 'sidebar' } },
  websiteSections(),
]
