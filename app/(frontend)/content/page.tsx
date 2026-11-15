import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

export const revalidate = 30
export default async function ContentIndex() {
  const payload = await getPayload({ config })
  const [pages, posts, settings] = await Promise.all([
    payload.find({ collection: 'pages', overrideAccess: false, limit: 20 }),
    payload.find({ collection: 'posts', overrideAccess: false, limit: 20 }),
    payload.findGlobal({ slug: 'site-settings', overrideAccess: false }),
  ])
  return <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-16">
    <h1 className="text-4xl font-semibold">{settings.websiteName}</h1>
    <p className="my-4">{settings.websiteDescription}</p>
    {([['pages', pages.docs], ['posts', posts.docs]] as const).map(([collection, docs]) => <section key={collection} className="my-8">
      <h2 className="text-2xl capitalize">{collection}</h2>
      {docs.length ? <ul className="my-4 space-y-3">{docs.map(doc => <li key={doc.id}><Link className="underline" href={`/content/${collection}/${doc.slug}`}>{doc.title}</Link></li>)}</ul> : <p>No published {collection} yet.</p>}
    </section>)}
  </main>
}
