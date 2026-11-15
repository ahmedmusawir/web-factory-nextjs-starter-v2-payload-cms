import { RichText } from '@payloadcms/richtext-lexical/react'
import { Artwork } from './artwork'
import type { Post } from '@/payload-types'
export function BlogArticle({ post }: { post: Post }) {
 return <main id="main" className="wrap blog article"><p className="eyebrow">{post.categories?.join(' / ') || 'Blog'}</p><h1>{post.title}</h1><p><time dateTime={post.publishedAt || undefined}>{post.publishedAt?.slice(0, 10)}</time></p>{post.featuredImage && typeof post.featuredImage === 'object' && <Artwork src={post.featuredImage.url || ''} alt={post.featuredImage.alt} width="1200" height="675" />}{post.content && <RichText data={post.content} />}</main>
}
