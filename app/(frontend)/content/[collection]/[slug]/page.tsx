import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { RichText } from '@payloadcms/richtext-lexical/react'
import config from '@payload-config'

export const revalidate = 30
export default async function ContentPage({ params }: { params: Promise<{ collection: string; slug: string }> }) {
  const { collection, slug } = await params
  if (collection !== 'pages' && collection !== 'posts') notFound()
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection, where: { slug: { equals: slug } }, overrideAccess: false, limit: 1 })
  const doc = docs[0]
  if (!doc) notFound()
  return <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-16">
    <h1 className="mb-8 text-4xl font-semibold">{doc.title}</h1>
    {doc.content && <RichText data={doc.content} />}
  </main>
}

export async function generateStaticParams() { return [] }
