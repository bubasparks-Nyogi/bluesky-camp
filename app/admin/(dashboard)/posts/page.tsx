import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import PostManager from '@/components/admin/PostManager'
import PostFilters from '@/components/admin/PostFilters'

interface Props {
  searchParams: { q?: string; category?: string; publish?: string }
}

export default async function AdminPostsPage({ searchParams }: Props) {
  let query = supabaseAdmin
    .from('posts')
    .select('id, slug, title, category, is_published, published_at, created_at')
    .order('created_at', { ascending: false })

  if (searchParams.q) query = query.ilike('title', `%${searchParams.q}%`)
  if (searchParams.category && searchParams.category !== 'all') query = query.eq('category', searchParams.category)
  if (searchParams.publish === 'published')   query = query.eq('is_published', true)
  if (searchParams.publish === 'unpublished') query = query.eq('is_published', false)

  const { data: posts } = await query
  const { count: totalCount } = await supabaseAdmin.from('posts').select('*', { count: 'exact', head: true })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">投稿管理</h1>
        <Link
          href="/admin/posts/new"
          className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + 新規作成
        </Link>
      </div>
      <PostFilters totalCount={totalCount ?? 0} visibleCount={posts?.length ?? 0} />
      <PostManager initialPosts={posts ?? []} />
    </div>
  )
}
