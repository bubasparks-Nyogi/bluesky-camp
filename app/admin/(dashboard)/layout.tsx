import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AdminLogoutButton from './LogoutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/admin/login')

  return (
    <div className="min-h-screen flex bg-warm-50">
      <aside className="w-48 bg-warm-700 text-warm-100 flex flex-col shrink-0">
        <div className="px-5 py-5 font-serif font-bold text-lg text-white border-b border-warm-600">
          @blueSky 管理
        </div>
        <nav className="flex-1 py-4">
          {[
            { href: '/admin',               label: '📅 予約カレンダー' },
            { href: '/admin/reservations',  label: '📋 予約一覧' },
            { href: '/admin/pricing',       label: '💴 料金設定' },
            { href: '/admin/rental-items',  label: '🎒 レンタル管理' },
            { href: '/admin/blocked-dates', label: '🚫 日程ブロック' },
            { href: '/admin/photos',        label: '📸 写真管理' },
            { href: '/admin/faqs',          label: '❓ FAQ管理' },
            { href: '/admin/reviews',       label: '⭐ レビュー管理' },
          ].map(item => (
            <Link key={item.href} href={item.href}
                  className="block px-5 py-2.5 text-sm hover:bg-warm-600 transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-warm-600">
          <AdminLogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
