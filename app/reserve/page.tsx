import type { Metadata } from 'next'
import Link from 'next/link'
import ReserveFlow from '@/components/reserve/ReserveFlow'

export const metadata: Metadata = {
  title: 'ご予約',
  description: '滋賀県高島市の一日一組限定キャンプ場 @blueSky のオンライン予約ページ。空き日程の確認から決済まで完結します。',
  openGraph: {
    title: 'ご予約 | @blueSky',
    description: '滋賀県高島市の一日一組限定キャンプ場 @blueSky のオンライン予約ページ。',
    url: '/reserve',
  },
  twitter: {
    card: 'summary',
    title: 'ご予約 | @blueSky',
    description: '滋賀県高島市の一日一組限定キャンプ場 @blueSky のオンライン予約ページ。',
  },
  alternates: {
    canonical: '/reserve',
  },
  robots: {
    index: false,
    follow: false,
  },
}
export default function ReservePage() {
  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-600 text-white py-4 px-4 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">@blueSky ご予約</span>
      </header>
      <ReserveFlow />
    </div>
  )
}
