import { WebsitePage, websiteMetadata } from '@/components/cyberize/website-page'
export const revalidate = 30
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return websiteMetadata((await params).slug) }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { return <WebsitePage slug={(await params).slug} /> }

export async function generateStaticParams() { return [] }
