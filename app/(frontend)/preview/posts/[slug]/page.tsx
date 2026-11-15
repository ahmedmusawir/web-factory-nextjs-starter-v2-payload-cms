import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { BlogArticle } from '@/components/cyberize/blog-article'
export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }
export default async function Preview({ params }: { params: Promise<{ slug: string }> }) {
 const payload = await getPayload({ config }); const { user } = await payload.auth({ headers: await headers() })
 if (!user || !['admin', 'editor'].includes(user.role)) notFound()
 const result = await payload.find({ collection: 'posts', user, overrideAccess: false, draft: true, depth: 2, where: { slug: { equals: (await params).slug } }, limit: 1 })
 if (!result.docs[0]) notFound()
 return <><aside>Authorized draft preview</aside><BlogArticle post={result.docs[0]} /></>
}
