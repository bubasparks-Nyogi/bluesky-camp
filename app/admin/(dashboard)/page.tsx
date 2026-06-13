import Link from 'next/link'
import ReservationCalendar from '@/components/admin/ReservationCalendar'
import StatsBar from '@/components/admin/StatsBar'
import { supabaseAdmin } from '@/lib/supabase'

export const metadata = { title: '予約カレンダー | @blueSky 管理' }
export const dynamic = 'force-dynamic'

async function fetchPendingDraftsCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('sale_drafts').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  return count ?? 0
}

export default async function AdminPage() {
  const pending = await fetchPendingDraftsCount()
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">予約カレンダー</h1>

      <Link href="/admin/sale-drafts"
        className={`block rounded-2xl p-4 mb-4 ${pending > 0 ? 'bg-warm-500 text-white' : 'bg-white border border-warm-100 text-warm-700'}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold">📋 未承認の抽出案</span>
          <span className={`font-bold rounded-full px-3 py-0.5 text-sm ${pending > 0 ? 'bg-white text-warm-700' : 'bg-warm-100 text-warm-500'}`}>
            {pending}
          </span>
        </div>
      </Link>

      <StatsBar />
      <ReservationCalendar />
    </div>
  )
}
