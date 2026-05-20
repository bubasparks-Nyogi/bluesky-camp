'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function AuthNav() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  const handleSignout = async () => {
    await fetch('/auth/signout', { method: 'POST' })
    setEmail(null)
    router.refresh()
  }

  if (loading) return null

  if (email) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/mypage" className="text-warm-600 hover:text-warm-700">👤 マイページ</Link>
        <button onClick={handleSignout} className="text-warm-400 hover:text-warm-600">ログアウト</button>
      </div>
    )
  }

  return (
    <Link href="/auth/login" className="text-sm text-warm-500 hover:text-warm-700">ログイン</Link>
  )
}
