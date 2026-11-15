import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { readWebsitePage, readSettings } from '@/cms/website-read'
import { contentReader, type SectionData } from '@/content/website'
import Home from './pages/home'
import SEO from './pages/seo-services'
import PPC from './pages/ppc'
import Design from './pages/website-design'
import Development from './pages/web-development'
import Support from './pages/website-support'
import Contact from './pages/contact'

const templates = { home: Home, 'seo-services': SEO, ppc: PPC, 'website-design': Design, 'web-development': Development, 'website-support': Support, contact: Contact }
export async function websiteMetadata(slug: string): Promise<Metadata> {
  const doc = await readWebsitePage(slug)
  return doc ? { title: doc.seoTitle || doc.title, description: doc.seoDescription, alternates: { canonical: slug === 'home' ? '/' : `/${slug}/` } } : { title: 'Page not found', robots: { index: false } }
}
export async function WebsitePage({ slug, preview = false }: { slug: string; preview?: boolean }) {
  const doc = await readWebsitePage(slug, preview)
  if (!doc) {
    if (slug === 'home' && !preview) return <main id="main" className="wrap closing"><h1>Website content has not been imported.</h1></main>
    notFound()
  }
  const Template = doc.template ? templates[doc.template as keyof typeof templates] : undefined
  if (!Template) notFound()
  const settings = await readSettings()
  const content = contentReader([...(doc.sections || []), ...(settings.sections || [])] as SectionData[], settings.contact || {})
  return <>{preview && <aside style={{ padding: 12, background: '#fff3cd' }}>Preview — unpublished changes. <a href={slug === 'home' ? '/' : `/${slug}/`}>View published page</a></aside>}<Template content={content} contactProvisional={settings.contactProvisional ?? true} /></>
}
