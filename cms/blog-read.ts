import 'server-only'
import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
export const readPosts = cache(async () => {
  if (process.env.ISR_DIAGNOSTICS === '1') console.log('CMS_READ blog')
  return (await getPayload({ config })).find({ collection: 'posts', overrideAccess: false, depth: 2, limit: 100, sort: '-publishedAt', where: { _status: { equals: 'published' } } })
})
export const readPost = cache(async (slug: string) => {
  if (process.env.ISR_DIAGNOSTICS === '1') console.log('CMS_READ article', slug)
  return (await (await getPayload({ config })).find({ collection: 'posts', overrideAccess: false, depth: 2, limit: 1, where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] } })).docs[0] || null
})
