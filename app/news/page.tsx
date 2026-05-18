import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

const VALID_CATEGORIES = ['news', 'event', 'blog']
const CATEGORY_LABEL: Record<string, string> = {
  news:  'お知らせ',
  event: 'イベント',
  blog:  'ブログ',
}

interface Props {
  searchParams: { category?: string }
}

export const metadata = {
  title: 'お知らせ',
  description: '@blueSky からの最新のお知らせ・イベント・ブログ記事一覧',
}

async function getPosts(category?: string) {
  let query = supabaseAdmin
    .from('posts')
    .select('id, slug, title, excerpt, cover_image, category, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (category && VALID_CATEGORIES.includes(category)) {
    query = query.eq('category', category)
  }
  const { data } = await query
  return data ?? []
}

export default async function NewsListPage({ searchParams }: Props) {
  const activeCategory = searchParams.category && VALID_CATEGORIES.includes(searchParams.category) ? searchParams.category : null
  const posts = await getPosts(activeCategory ?? undefined)

  return (
    <main className="min-h-screen bg-warm-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-serif text-3xl text-warm-700 text-center mb-2">お知らせ</h1>
        <p className="text-warm-400 text-sm tracking-widest text-center mb-8">NEWS / EVENTS / BLOG</p>

        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          <Link
            href="/news"
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
              !activeCategory ? 'bg-warm-500 text-white border-warm-500' : 'border-warm-200 text-warm-500 hover:bg-warm-100'
            }`}
          >
            すべて
          </Link>
          {VALID_CATEGORIES.map(c => (
            <Link
              key={c}
              href={`/news?category=${c}`}
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                activeCategory === c ? 'bg-warm-500 text-white border-warm-500' : 'border-warm-200 text-warm-500 hover:bg-warm-100'
              }`}
            >
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-warm-400 py-12">記事はまだありません</p>
        ) : (
          <div className="space-y-4">
            {posts.map(p => (
              <Link
                key={p.id}
                href={`/news/${p.slug}`}
                className="block bg-white rounded-xl border border-warm-100 p-5 hover:shadow-md transition-shadow"
              >
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
                <h2 className="font-bold text-warm-700 text-lg mb-1">{p.title}</h2>
                {p.excerpt && <p className="text-warm-500 text-sm">{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link href="/" className="text-warm-500 text-sm hover:text-warm-700 underline">← トップに戻る</Link>
        </div>
      </div>
    </main>
  )
}
