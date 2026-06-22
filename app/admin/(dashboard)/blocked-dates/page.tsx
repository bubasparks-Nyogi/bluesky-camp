import { supabaseAdmin } from '@/lib/supabase'
import BlockedDatesView from '@/components/admin/BlockedDatesView'

export const metadata = { title: '日程ブロック | @blueSky 管理' }
export const dynamic = 'force-dynamic'

export default async function AdminBlockedDatesPage() {
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: blocked }, { data: reservations }] = await Promise.all([
    supabaseAdmin.from('blocked_dates').select('id, date, reason').order('date'),
    supabaseAdmin.from('reservations')
      .select('checkin_date, guest_name').neq('status', 'cancelled')
      .gte('checkin_date', today),
  ])

  const reserved = (reservations ?? []).map(r => ({
    date: r.checkin_date as string, guestName: r.guest_name as string,
  }))

  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">日程ブロック</h1>
      <BlockedDatesView blocked={blocked ?? []} reserved={reserved} />
    </div>
  )
}
