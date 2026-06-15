import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import CheckinButton from './CheckinButton'
import type { ReservationRow, StayType } from '@/types/reservation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'チェックイン | @blueSky 管理' }

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}
const STATUS_LABELS: Record<string, string> = {
  pending: '確認中', confirmed: '確定', cancelled: 'キャンセル済',
}

export default async function AdminCheckinPage({ params }: { params: { id: string } }) {
  const { data: r } = await supabaseAdmin
    .from('reservations').select('*').eq('id', params.id).maybeSingle()
  if (!r) notFound()
  const reservation = r as ReservationRow & { checked_in_at?: string | null }

  const types: StayType[] = Array.isArray(reservation.stay_types) && reservation.stay_types.length
    ? reservation.stay_types as StayType[]
    : [reservation.stay_type as StayType]
  const typeLabel = types.map(t => STAY_LABELS[t] ?? t).join('・')
  const shortId = reservation.id.slice(0, 8).toUpperCase()

  return (
    <main className="max-w-md mx-auto">
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-2">📋 チェックイン</h1>
      <p className="text-warm-400 text-xs mb-6">予約番号 {shortId}</p>

      <section className="bg-white border border-warm-100 rounded-2xl p-5 mb-4 space-y-2">
        <p className="text-2xl font-bold text-warm-700">{reservation.guest_name} 様</p>
        <p className="text-warm-500 text-sm">
          <strong>状態:</strong>{' '}
          {STATUS_LABELS[reservation.status] ?? reservation.status}
        </p>
        <p className="text-warm-500 text-sm">
          <strong>日程:</strong> {reservation.checkin_date} 〜 {reservation.checkout_date}
        </p>
        <p className="text-warm-500 text-sm">
          <strong>宿泊タイプ:</strong> {typeLabel}
        </p>
        {reservation.sauna && <p className="text-warm-500 text-sm"><strong>サウナ:</strong> 利用</p>}
        {reservation.pet   && <p className="text-warm-500 text-sm"><strong>ペット:</strong> 同伴</p>}
        {reservation.ehu   && <p className="text-warm-500 text-sm"><strong>EHU:</strong> 使用</p>}
        {reservation.transfer_count > 0 && (
          <p className="text-warm-500 text-sm"><strong>送迎:</strong> {reservation.transfer_count}名（{reservation.transfer_station ?? ''}）</p>
        )}
        <p className="text-warm-500 text-sm"><strong>連絡先:</strong> <a href={`tel:${reservation.guest_phone.replace(/-/g, '')}`} className="underline text-warm-700">{reservation.guest_phone}</a></p>
        <p className="text-warm-500 text-sm"><strong>合計:</strong> ¥{reservation.total_amount.toLocaleString()}</p>
      </section>

      {reservation.status === 'cancelled' ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-600 text-sm">
          この予約はキャンセル済みです
        </div>
      ) : (
        <CheckinButton reservationId={reservation.id} alreadyChecked={!!reservation.checked_in_at} />
      )}

      <Link href="/admin/reservations" className="block mt-6 text-warm-500 text-sm text-center underline">
        ← 予約一覧に戻る
      </Link>
    </main>
  )
}
