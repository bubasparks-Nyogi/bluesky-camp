// app/reserve/lookup/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { calcCancellationFee } from '@/lib/cancellation'
import CancelModalWrapper from './CancelModalWrapper'

const STAY_LABELS: Record<string, string> = {
  tent:      'テント設営',
  trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB',
  campervan: 'キャンピングカー乗り入れ',
}
const STATUS_LABELS: Record<string, string> = {
  pending:   '確認中',
  confirmed: '確定',
  cancelled: 'キャンセル済み',
}
const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-400',
}

export default async function ReservationLookupDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!r) notFound()

  const feeResult = calcCancellationFee(r.checkin_date, r.total_amount)
  const types     = Array.isArray(r.stay_types) && r.stay_types.length
    ? (r.stay_types as string[])
    : [(r.stay_type as string)]
  const canCancel = r.status !== 'cancelled'

  // 泊数計算（最低1泊）
  const nights = Math.max(1, Math.round(
    (new Date(r.checkout_date).getTime() - new Date(r.checkin_date).getTime())
    / (1000 * 60 * 60 * 24)
  ))

  const rentalItems = Array.isArray(r.rental_items)
    ? (r.rental_items as { name: string; qty: number; price: number }[])
    : []

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-600 text-white py-4 px-6 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">予約確認</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-warm-400 mb-1">予約番号</p>
              <p className="font-bold text-warm-700 text-lg tracking-widest">
                {r.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[r.status] ?? r.status}
            </span>
          </div>

          <dl className="space-y-3 text-sm">
            {([
              ['チェックイン',   r.checkin_date],
              ['チェックアウト', r.checkout_date],
              ['宿泊タイプ',     types.map((t: string) => STAY_LABELS[t] ?? t).join('・')],
              ['サウナ',         r.sauna ? '利用' : 'なし'],
              ['ペット',         r.pet   ? '同伴' : 'なし'],
              ['EHU',            r.ehu   ? '使用（使用量料金制）' : 'なし'],
              ['お名前',         r.guest_name],
              ['メール',         r.guest_email],
              ['電話番号',       r.guest_phone],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <dt className="w-28 shrink-0 text-warm-400">{k}</dt>
                <dd className="text-warm-700">{v}</dd>
              </div>
            ))}
          </dl>

          {/* 送迎カード */}
          {r.transfer_count > 0 && (
            <div className="mt-4 pt-4 border-t border-warm-100">
              <p className="text-xs text-warm-400 mb-2">🚌 送迎</p>
              <div className="bg-warm-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-warm-700">{r.transfer_station}</p>
                <p className="text-warm-500 mt-0.5">{r.transfer_count}名</p>
              </div>
            </div>
          )}

          {/* レンタル道具カード */}
          {rentalItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-warm-100">
              <p className="text-xs text-warm-400 mb-2">🎒 レンタル道具</p>
              <div className="space-y-2">
                {rentalItems.map((item, i) => {
                  const subtotal = item.price * item.qty * nights
                  return (
                    <div key={i} className="bg-warm-50 rounded-lg p-3 flex justify-between items-start text-sm">
                      <div>
                        <p className="font-medium text-warm-700">{item.name} × {item.qty}個</p>
                        <p className="text-xs text-warm-400 mt-0.5">
                          ¥{item.price.toLocaleString()}/泊 × {nights}泊
                        </p>
                      </div>
                      <p className="font-bold text-warm-700">¥{subtotal.toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-warm-100 flex justify-between items-center">
            <span className="text-warm-500 text-sm">合計金額</span>
            <span className="font-bold text-warm-700 text-lg">
              ¥{r.total_amount.toLocaleString()}
            </span>
          </div>

          {process.env.NEXT_PUBLIC_LIFF_ID && canCancel && (
            <a
              href={`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?reservationId=${r.id}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-6 block bg-[#06C755] hover:bg-[#05a847] text-white text-center font-bold py-3 px-4 rounded-lg transition-colors"
            >
              📱 LINEで連絡する
              <span className="block text-xs font-normal mt-1">当日の追加注文や質問はLINEでお気軽にどうぞ</span>
            </a>
          )}
        </div>

        {canCancel && (
          <>
            <Link href={`/reserve/lookup/${r.id}/edit`}
              className="block bg-warm-500 hover:bg-warm-600 text-white text-center font-bold py-3 px-4 rounded-lg mb-3 transition-colors">
              📝 予約を変更する
            </Link>
            <CancelModalWrapper
              reservationId={r.id}
              guestEmail={r.guest_email}
              checkinDate={r.checkin_date}
              totalAmount={r.total_amount}
              feeResult={feeResult}
            />
          </>
        )}

        {r.status === 'cancelled' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-600">
            この予約はキャンセル済みです
          </div>
        )}
      </main>
    </div>
  )
}
