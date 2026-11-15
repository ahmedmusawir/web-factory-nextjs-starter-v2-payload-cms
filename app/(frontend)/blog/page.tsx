import Link from 'next/link'
import { readPosts } from '@/cms/blog-read'
import { Artwork } from '@/components/cyberize/artwork'
export const revalidate = 30
export const metadata = { title: 'Blog — Cyberize Group', description: 'Practical insights on SEO, advertising, websites and digital marketing.' }
export default async function Blog() {
  const posts = await readPosts()
  return <main id="main" className="wrap blog"><p className="eyebrow">Ideas and insights</p><h1>Our blog.</h1><div className="blog-grid">{posts.docs.map(post => <article key={post.id}><Link href={`/blog/${post.slug}`}>{post.featuredImage && typeof post.featuredImage === 'object' && <Artwork src={post.featuredImage.url || ''} alt={post.featuredImage.alt} width="800" height="450" />}<h2>{post.title}</h2></Link><p>{post.excerpt}</p><small>{post.publishedAt && new Date(post.publishedAt).toISOString().slice(0, 10)} · {post.categories?.join(' / ')}</small></article>)}</div></main>
}
