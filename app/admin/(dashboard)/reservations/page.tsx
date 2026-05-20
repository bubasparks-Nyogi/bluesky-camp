import { supabaseAdmin } from '@/lib/supabase'
import ReservationList from '@/components/admin/ReservationList'
import ReservationFilters from '@/components/admin/ReservationFilters'
import type { ReservationRow } from '@/types/reservation'

export const metadata = { title: '予約一覧 | @blueSky 管理' }

interface Props {
  searchParams: { q?: string; status?: string; stay?: string; from?: string; to?: string }
}

export default async function AdminReservationsPage({ searchParams }: Props) {
  let query = supabaseAdmin.from('reservations').select('*', { count: 'exact' }).order('checkin_date', { ascending: false })
  if (searchParams.q) {
    const pattern = `%${searchParams.q}%`
    query = query.or(`guest_name.ilike.${pattern},guest_email.ilike.${pattern},guest_phone.ilike.${pattern}`)
  }
  if (searchParams.status && searchParams.status !== 'all') query = query.eq('status', searchParams.status)
  if (searchParams.stay   && searchParams.stay   !== 'all') query = query.eq('stay_type', searchParams.stay)
  if (searchParams.from)  query = query.gte('checkin_date', searchParams.from)
  if (searchParams.to)    query = query.lte('checkin_date', searchParams.to)
  const { data: reservations } = await query

  const { count: totalCount } = await supabaseAdmin.from('reservations').select('*', { count: 'exact', head: true })

  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">予約一覧</h1>
      <ReservationFilters totalCount={totalCount ?? 0} visibleCount={reservations?.length ?? 0} />
      <ReservationList reservations={(reservations ?? []) as ReservationRow[]} />
    </div>
  )
}
