import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

interface PostListItem {
  id: string
  slug: string
  title: string
  excerpt: string | null
  cover_image: string | null
  category: string
  published_at: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  news:  'お知らせ',
  event: 'イベント',
  blog:  'ブログ',
}

async function getLatestPosts(): Promise<PostListItem[]> {
  const { data } = await supabaseAdmin
    .from('posts')
    .select('id, slug, title, excerpt, cover_image, category, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(3)
  return data ?? []
}

export default async function NewsSection() {
  const posts = await getLatestPosts()
  if (posts.length === 0) return null

  return (
    <section id="news" className="py-20 px-4 bg-warm-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-serif text-2xl md:text-3xl text-warm-600 mb-2">お知らせ</h2>
          <p className="text-warm-400 text-sm tracking-widest">NEWS</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.map(p => (
            <Link
              key={p.id}
              href={`/news/${p.slug}`}
              className="bg-white rounded-xl border border-warm-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              {p.cover_image && (
                <img src={p.cover_image} alt={p.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABEL[p.category] ?? p.category}
                  </span>
                  {p.published_at && (
                    <span className="text-xs text-warm-400">
                      {new Date(p.published_at).toLocaleDateString('ja-JP')}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-warm-700 text-base mb-2 line-clamp-2">{p.title}</h3>
                {p.excerpt && <p className="text-warm-500 text-sm line-clamp-3 flex-1">{p.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/news"
            className="inline-block border border-warm-300 text-warm-500 hover:bg-warm-100 px-6 py-2 rounded-full text-sm transition-colors"
          >
            すべて見る →
          </Link>
        </div>
      </div>
    </section>
  )
}
