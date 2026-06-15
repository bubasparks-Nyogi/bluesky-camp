'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AdminLogoutButton from './LogoutButton'

interface NavItem { href: string; label: string }
interface NavGroup { label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    label: '予約・お客様',
    items: [
      { href: '/admin',                label: '📅 予約カレンダー' },
      { href: '/admin/reservations',   label: '📋 予約一覧' },
      { href: '/admin/sale-drafts',    label: '📝 抽出案承認' },
      { href: '/admin/blocked-dates',  label: '🚫 日程ブロック' },
    ],
  },
  {
    label: '販売・在庫',
    items: [
      { href: '/admin/items',         label: '🍖 商品・メニュー' },
      { href: '/admin/inventory',     label: '📦 在庫管理' },
      { href: '/admin/rental-items',  label: '🎒 レンタル管理' },
      { href: '/admin/pricing',       label: '💴 料金設定' },
    ],
  },
  {
    label: '会計',
    items: [
      { href: '/admin/accounting',        label: '🧮 仕訳・元帳' },
      { href: '/admin/accounting/report', label: '📊 決算書' },
    ],
  },
  {
    label: 'コンテンツ',
    items: [
      { href: '/admin/photos',  label: '📸 写真管理' },
      { href: '/admin/faqs',    label: '❓ FAQ管理' },
      { href: '/admin/reviews', label: '⭐ レビュー管理' },
      { href: '/admin/posts',   label: '📝 投稿管理' },
    ],
  },
  {
    label: 'その他',
    items: [
      { href: '/admin/site-settings', label: '⚙️ サイト設定' },
      { href: '/admin/usage-guide',   label: '📖 使い方ガイド' },
      { href: '/admin/manual',        label: '📘 運用手順書' },
    ],
  },
]

export default function AdminNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const Nav = (
    <nav className="flex-1 py-4 overflow-y-auto">
      {GROUPS.map(group => (
        <div key={group.label} className="mb-4">
          <p className="px-5 py-1 text-xs uppercase tracking-wider text-warm-300">{group.label}</p>
          {group.items.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className={`block px-5 py-2 text-sm transition-colors
                      ${active ? 'bg-warm-600 text-white font-bold' : 'hover:bg-warm-600'}`}>
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )

  return (
    <>
      {/* モバイル: 上部バー + ハンバーガー */}
      <div className="lg:hidden sticky top-0 z-30 bg-warm-700 text-white flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen(true)} aria-label="メニュー" className="text-2xl">☰</button>
        <span className="font-serif font-bold">@blueSky 管理</span>
      </div>

      {/* モバイルドロワー */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <aside className="w-64 bg-warm-700 text-warm-100 flex flex-col">
            <div className="px-5 py-5 font-serif font-bold text-lg text-white border-b border-warm-600 flex items-center justify-between">
              <span>@blueSky 管理</span>
              <button onClick={() => setOpen(false)} aria-label="閉じる" className="text-xl">✕</button>
            </div>
            {Nav}
            <div className="p-4 border-t border-warm-600">
              <AdminLogoutButton />
            </div>
          </aside>
          <div onClick={() => setOpen(false)} className="flex-1 bg-black/40" />
        </div>
      )}

      {/* PC: 固定サイドバー */}
      <aside className="hidden lg:flex w-52 bg-warm-700 text-warm-100 flex-col shrink-0">
        <div className="px-5 py-5 font-serif font-bold text-lg text-white border-b border-warm-600">
          @blueSky 管理
        </div>
        {Nav}
        <div className="p-4 border-t border-warm-600">
          <AdminLogoutButton />
        </div>
      </aside>
    </>
  )
}
