import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { SITE_URL } from '@/lib/seo-constants'
import PostBody from '@/components/PostBody'

interface Props { params: { slug: string } }

const CATEGORY_LABEL: Record<string, string> = {
  news:  'お知らせ',
  event: 'イベント',
  blog:  'ブログ',
}

async function getPost(slug: string) {
  const { data } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)
  if (!post) return { title: '記事が見つかりません' }

  const url = `${SITE_URL}/news/${post.slug}`
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: url },
    openGraph: {
      title: `${post.title} | @blueSky`,
      description: post.excerpt ?? undefined,
      url,
      type: 'article',
      images: post.cover_image ? [{ url: post.cover_image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} | @blueSky`,
      description: post.excerpt ?? undefined,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  }
}

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.slug)
  if (!post) notFound()

  return (
    <main className="min-h-screen bg-white py-16 px-4">
      <article className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/news" className="text-warm-500 text-sm hover:text-warm-700">← 一覧に戻る</Link>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
          {post.published_at && (
            <span className="text-xs text-warm-400">
              {new Date(post.published_at).toLocaleDateString('ja-JP')}
            </span>
          )}
        </div>

        <h1 className="font-serif text-3xl text-warm-700 mb-6">{post.title}</h1>

        {post.cover_image && (
          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden mb-8">
            <Image src={post.cover_image} alt={post.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
          </div>
        )}

        <PostBody markdown={post.body} />
      </article>
    </main>
  )
}
