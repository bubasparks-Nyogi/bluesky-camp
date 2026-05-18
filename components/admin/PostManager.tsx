'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Post {
  id: string
  slug: string
  title: string
  category: string
  is_published: boolean
  published_at: string | null
  created_at: string
}

interface Props {
  initialPosts: Post[]
}

const CATEGORY_LABEL: Record<string, string> = {
  news:  'お知らせ',
  event: 'イベント',
  blog:  'ブログ',
}

export default function PostManager({ initialPosts }: Props) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>(initialPosts)

  const togglePublish = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current }),
    })
    if (res.ok) {
      setPosts(ps => ps.map(p => p.id === id ? { ...p, is_published: !current } : p))
      router.refresh()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この記事を削除しますか？')) return
    const res = await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    if (res.ok) setPosts(ps => ps.filter(p => p.id !== id))
  }

  if (posts.length === 0) {
    return <p className="text-warm-400 text-sm">記事はまだありません。「新規作成」から投稿してください。</p>
  }

  return (
    <div className="space-y-3">
      {posts.map(p => (
        <div key={p.id} className={`border rounded-xl p-4 flex items-center justify-between gap-4 ${p.is_published ? 'border-green-200 bg-green-50' : 'border-warm-200 bg-white'}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">
                {CATEGORY_LABEL[p.category] ?? p.category}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-500'}`}>
                {p.is_published ? '公開中' : '下書き'}
              </span>
              <span className="text-xs text-warm-300">/news/{p.slug}</span>
            </div>
            <h3 className="font-medium text-warm-700 truncate">{p.title}</h3>
            <p className="text-warm-300 text-xs mt-1">
              作成: {new Date(p.created_at).toLocaleDateString('ja-JP')}
              {p.published_at && ` · 公開: ${new Date(p.published_at).toLocaleDateString('ja-JP')}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href={`/admin/posts/${p.id}`}
              className="text-xs px-3 py-1.5 rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200 transition-colors font-medium text-center"
            >
              編集
            </Link>
            <button
              onClick={() => togglePublish(p.id, p.is_published)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                p.is_published
                  ? 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {p.is_published ? '非公開' : '公開'}
            </button>
            <button
              onClick={() => handleDelete(p.id)}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-medium"
            >
              削除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
