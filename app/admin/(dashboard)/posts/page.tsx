import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import PostManager from '@/components/admin/PostManager'

async function getAllPosts() {
  const { data } = await supabaseAdmin
    .from('posts')
    .select('id, slug, title, category, is_published, published_at, created_at')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminPostsPage() {
  const posts = await getAllPosts()

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
      <PostManager initialPosts={posts} />
    </div>
  )
}
