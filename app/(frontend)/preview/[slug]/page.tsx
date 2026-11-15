import { WebsitePage } from '@/components/cyberize/website-page'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'Editorial preview', robots: { index: false, follow: false } }
export default async function Preview({ params }: { params: Promise<{ slug: string }> }) { return <WebsitePage slug={(await params).slug} preview /> }
