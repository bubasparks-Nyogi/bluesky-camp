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
  alternates: { canonical: '/reserve' },
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: { date?: string }
}

function parseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  const d = new Date(raw)
  if (isNaN(d.getTime())) return undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d < today) return undefined
  return raw
}

export default function ReservePage({ searchParams }: Props) {
  const initialDate = parseDate(searchParams.date)
  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-600 text-white py-4 px-4 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">@blueSky ご予約</span>
      </header>
      <ReserveFlow initialDate={initialDate} />
    </div>
  )
}
