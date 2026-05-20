'use client'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { SITE_URL } from '@/lib/seo-constants'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent,  setSent]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <main className="min-h-screen bg-warm-50 flex items-center justify-center px-4 py-16">
      <div className="bg-white border border-warm-100 rounded-2xl p-8 max-w-md w-full">
        <h1 className="font-serif text-2xl text-warm-700 text-center mb-2">ログイン / 新規登録</h1>
        <p className="text-warm-400 text-sm text-center mb-8">メールアドレスに送られるリンクをクリックしてログインします</p>

        {sent ? (
          <div className="text-center">
            <div className="text-3xl mb-3">📬</div>
            <p className="text-warm-700 font-medium mb-1">メールを送信しました</p>
            <p className="text-warm-400 text-sm">{email} に届くリンクをクリックしてください。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div>
              <label className="block text-sm text-warm-500 mb-1">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-warm-500 hover:bg-warm-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? '送信中...' : 'マジックリンクを送信'}
            </button>
            <p className="text-warm-300 text-xs text-center">初めての方も同じフォームから登録できます</p>
          </form>
        )}
      </div>
    </main>
  )
}
