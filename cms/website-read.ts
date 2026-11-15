import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

export const readSettings = cache(async () => {
  if (process.env.ISR_DIAGNOSTICS === '1') console.log('CMS_READ settings')
  const payload = await getPayload({ config })
  return payload.findGlobal({ slug: 'site-settings', depth: 2, overrideAccess: false })
})
export const readWebsitePage = cache(async (slug: string, preview = false) => {
  const payload = await getPayload({ config })
  if (process.env.ISR_DIAGNOSTICS === '1') console.log('CMS_READ page', slug, preview ? 'preview' : 'public')
  const user = preview ? (await payload.auth({ headers: await headers() })).user : undefined
  if (preview && (!user || !['admin', 'editor'].includes(user.role))) return null
  const result = await payload.find({ collection: 'pages', where: { and: [{ slug: { equals: slug } }, { template: { exists: true } }] }, draft: preview, overrideAccess: false, user, depth: 2, limit: 1 })
  return result.docs[0] || null
})
