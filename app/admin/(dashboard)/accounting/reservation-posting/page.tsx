import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { filterPostableReservations } from '@/lib/accounting/reservationPosting'
import ReservationPostingList from '@/components/admin/accounting/ReservationPostingList'

export const revalidate = 0

export default async function ReservationPostingPage() {
  const today = new Date().toISOString().slice(0, 10)

  const { data: rows } = await supabaseAdmin
    .from('reservations')
    .select('id, guest_name, total_amount, payment_method, checkin_date, checkout_date, status')
    .lte('checkout_date', today)
    .eq('status', 'confirmed')

  const { data: posted } = await supabaseAdmin
    .from('journal_entries')
    .select('source_id')
    .eq('source', 'reservation')
    .like('source_id', '%:revenue')
  const postedIds = new Set((posted ?? []).map(p => (p.source_id as string).replace(':revenue', '')))

  const postable = filterPostableReservations(rows ?? [], today, postedIds)
  const nameById = new Map((rows ?? []).map(r => [r.id, r.guest_name as string]))

  const initial = postable.map(r => ({
    id: r.id,
    guestName: nameById.get(r.id) ?? '—',
    checkinDate: r.checkinDate,
    checkoutDate: r.checkoutDate,
    totalAmount: r.totalAmount,
    paymentMethod: r.paymentMethod,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">予約売上計上</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">チェックアウト日を過ぎた確定予約のうち、まだ売上計上していないものを表示しています。</p>
      <ReservationPostingList initial={initial} />
    </div>
  )
}
