'use client'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function AdminLogoutButton() {
  const router   = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }
  return (
    <button onClick={handleLogout}
            className="w-full text-left text-sm text-warm-300 hover:text-white transition-colors">
      🚪 ログアウト
    </button>
  )
}
