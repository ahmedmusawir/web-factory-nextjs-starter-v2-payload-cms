import structure from './poc-structure.json'
export type ContentReader = (group: string, field: string) => string
export type SectionData = { key: string; [field: string]: unknown }
export const websiteStructure = structure
export function fieldName(source: string) {
  if (source === 'h1_text_1') return 'heroHeading'
  return source.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase())
}
export function destination(value: string): string {
  const routes: Record<string, string> = { 'home.html': '/', 'seo.html': '/seo-services/', 'ppc.html': '/ppc/', 'web-design.html': '/website-design/', 'web-development.html': '/web-development/', 'website-support.html': '/website-support/', 'contact.html': '/contact/' }
  const [pathname, hash] = value.split('#')
  return (routes[pathname] ?? pathname) + (hash === undefined ? '' : `#${hash}`)
}
export function contentReader(sections: SectionData[], contact: Record<string, unknown> = {}): ContentReader {
  return (group, field) => {
    if (group === 'settings') return typeof contact[field] === 'string' ? String(contact[field]) : ''
    const [section, key] = field.split('.')
    const row = sections.find(item => item.key === `${group}.${section}`)
    const value = row?.[fieldName(key)]
    if (key.startsWith('img_src_')) return value && typeof value === 'object' && 'url' in value && typeof value.url === 'string' ? value.url : ''
    return typeof value === 'string' ? value : ''
  }
}
export const safeEditorialLink = (value: unknown) => typeof value !== 'string' || value === '' || (/^(?:\/(?!\/)|#|https:\/\/|mailto:|tel:)/i.test(value) && !/[\u0000-\u001f\\]/.test(value))
