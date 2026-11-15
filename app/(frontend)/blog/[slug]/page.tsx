import { notFound } from 'next/navigation'
import { readPost } from '@/cms/blog-read'
import { BlogArticle } from '@/components/cyberize/blog-article'
export const revalidate = 30
export async function generateStaticParams() { return [] }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const post = await readPost((await params).slug)
 return post ? { title: post.seoTitle || post.title, description: post.seoDescription || post.excerpt, alternates: { canonical: `/blog/${post.slug}` } } : { title: 'Article not found' }
}
export default async function Article({ params }: { params: Promise<{ slug: string }> }) {
 const post = await readPost((await params).slug); if (!post) notFound()
 return <BlogArticle post={post} />
}
