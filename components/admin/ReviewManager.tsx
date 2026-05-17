'use client'
import { useState } from 'react'

interface Review {
  id: string
  guest_name: string
  rating: number
  comment: string
  visit_date: string | null
  is_published: boolean
  created_at: string
}

interface Props {
  initialReviews: Review[]
}

export default function ReviewManager({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)

  const togglePublish = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current }),
    })
    if (res.ok) {
      setReviews(rs => rs.map(r => r.id === id ? { ...r, is_published: !current } : r))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このレビューを削除しますか？')) return
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setReviews(rs => rs.filter(r => r.id !== id))
    }
  }

  if (reviews.length === 0) {
    return <p className="text-warm-400 text-sm">レビューはまだありません。</p>
  }

  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <div key={r.id} className={`border rounded-xl p-5 ${r.is_published ? 'border-green-200 bg-green-50' : 'border-warm-200 bg-white'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <span className="font-medium text-warm-700">{r.guest_name}</span>
                <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_published ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-500'}`}>
                  {r.is_published ? '公開中' : '未承認'}
                </span>
              </div>
              <p className="text-warm-600 text-sm leading-relaxed mb-1">{r.comment}</p>
              <p className="text-warm-300 text-xs">
                {r.visit_date ? `${r.visit_date} ご宿泊 · ` : ''}
                投稿: {new Date(r.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => togglePublish(r.id, r.is_published)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  r.is_published
                    ? 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {r.is_published ? '非公開にする' : '承認する'}
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-medium"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
