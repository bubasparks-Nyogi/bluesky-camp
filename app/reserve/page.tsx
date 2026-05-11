import Link from 'next/link'
import ReserveFlow from '@/components/reserve/ReserveFlow'
export const metadata = { title: 'ご予約 | @blueSky' }
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
