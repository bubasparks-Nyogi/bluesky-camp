import { supabaseAdmin } from '@/lib/supabase'
import ReservationList from '@/components/admin/ReservationList'
import type { ReservationRow } from '@/types/reservation'
export const metadata = { title: '予約一覧 | @blueSky 管理' }
export default async function AdminReservationsPage() {
  const { data } = await supabaseAdmin.from('reservations').select('*').order('checkin_date', { ascending: false })
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">予約一覧</h1>
      <ReservationList reservations={(data ?? []) as ReservationRow[]} />
    </div>
  )
}
