'use client'
import { useState } from 'react'

export default function ReviewForm() {
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [rating, setRating]   = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: name, rating, comment }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '送信に失敗しました'); return }
      setDone(true)
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="text-center mt-10">
        <button
          onClick={() => setOpen(true)}
          className="inline-block border border-warm-300 text-warm-500 hover:bg-warm-100 px-6 py-2 rounded-full text-sm transition-colors"
        >
          ✏️ クチコミを書く
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mt-8 bg-warm-50 border border-warm-200 rounded-xl p-6 text-center max-w-md mx-auto">
        <div className="text-2xl mb-2">🙏</div>
        <p className="text-warm-600 font-medium">レビューありがとうございます！</p>
        <p className="text-warm-400 text-sm mt-1">確認後に公開されます。</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 bg-warm-50 border border-warm-200 rounded-xl p-6 max-w-md mx-auto space-y-4">
      <h3 className="font-serif text-warm-600 font-bold text-lg">クチコミを投稿</h3>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div>
        <label className="block text-sm text-warm-500 mb-1">お名前 <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="田中 太郎"
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-2">評価 <span className="text-red-400">*</span></label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`text-2xl transition-transform hover:scale-110 ${n <= rating ? 'opacity-100' : 'opacity-30'}`}
              aria-label={`${n}つ星`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-1">コメント <span className="text-red-400">*</span></label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          required
          rows={4}
          placeholder="滞在の感想をお聞かせください..."
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
        >
          {submitting ? '送信中...' : '投稿する'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2.5 border border-warm-200 text-warm-400 hover:bg-warm-100 rounded-lg text-sm transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
