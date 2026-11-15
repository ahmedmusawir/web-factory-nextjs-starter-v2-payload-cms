import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'
const invalidate = (collection: string, slug: string) => {
  revalidatePath(collection === 'posts' ? `/blog/${slug}` : slug === 'home' ? '/' : `/${slug}`)
  if (collection === 'posts') revalidatePath('/blog')
  revalidatePath(`/content/${collection}/${slug}`)
  revalidatePath('/content')
}
export const invalidatePublished: CollectionAfterChangeHook = ({ doc, previousDoc, collection, req }) => {
  if (req.context.skipRevalidation || !req.user) return doc
  if (doc._status === 'published' || (previousDoc?._status === 'published' && !req.query?.draft)) {
    invalidate(collection.slug, doc.slug)
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) invalidate(collection.slug, previousDoc.slug)
  }
  return doc
}
export const invalidateDeleted: CollectionAfterDeleteHook = ({ doc, collection, req }) => {
  if (req.user && !req.context.skipRevalidation) invalidate(collection.slug, doc.slug)
  return doc
}
export const invalidateSettings: GlobalAfterChangeHook = ({ doc, req }) => {
  if (req.user && !req.context.skipRevalidation) revalidatePath('/', 'layout')
  return doc
}

export const invalidateMedia: CollectionAfterChangeHook = ({ doc, req }) => {
 if (req.user && !req.context.skipRevalidation) revalidatePath('/', 'layout')
 return doc
}
