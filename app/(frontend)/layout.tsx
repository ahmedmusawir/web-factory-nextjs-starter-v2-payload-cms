import type { Metadata } from 'next'
import { Header } from '@/components/cyberize/header'
import { Footer } from '@/components/cyberize/footer'
import { readSettings } from '@/cms/website-read'
import { contentReader, websiteStructure, type SectionData } from '@/content/website'
import './globals.css'
export const revalidate = 30
export async function generateMetadata(): Promise<Metadata> {
  const settings = await readSettings()
  return { title: settings.websiteName, description: settings.websiteDescription }
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await readSettings()
  const content = contentReader((settings.sections || []) as SectionData[], settings.contact || {})
  const copy = Object.fromEntries(websiteStructure.sections['shared.header'].map(key => [`header.${key}`, content('shared', `header.${key}`)]))
  const ready = Boolean(settings.sections?.length)
  return <html lang="en"><body><a className="skip" href="#main">Skip to content</a>{ready && <Header copy={copy} />}{children}{ready && <Footer content={content} contactProvisional={settings.contactProvisional ?? true} />}</body></html>
}
