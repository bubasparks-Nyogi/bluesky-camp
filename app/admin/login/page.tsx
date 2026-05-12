'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AdminLoginPage() {
  const router   = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-warm-700 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="font-serif text-2xl text-warm-600 font-bold text-center mb-8">
          @blueSky 管理
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-warm-500 mb-1">メールアドレス</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                   className="w-full border border-warm-200 rounded-lg px-4 py-3 text-warm-700
                              focus:outline-none focus:border-warm-400 text-base" />
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">パスワード</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                   className="w-full border border-warm-200 rounded-lg px-4 py-3 text-warm-700
                              focus:outline-none focus:border-warm-400 text-base" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
                  className="w-full bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white
                             font-bold py-3 rounded-lg transition-colors text-base mt-2">
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
