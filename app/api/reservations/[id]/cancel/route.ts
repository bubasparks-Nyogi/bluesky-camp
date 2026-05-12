// app/api/reservations/[id]/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calcCancellationFee } from '@/lib/cancellation'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 })
  }

  // 予約を取得
  const { data: reservation, error: fetchErr } = await supabaseAdmin
    .from('reservations')
    .select('id, guest_email, status, checkin_date, total_amount')
    .eq('id', params.id)
    .single()

  if (fetchErr || !reservation) {
    return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  }

  // 所有権確認（メールアドレス照合）— セキュリティのため 403 も 404 と同じメッセージ
  if (reservation.guest_email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: '予約が見つかりません' }, { status: 403 })
  }

  // すでにキャンセル済み
  if (reservation.status === 'cancelled') {
    return NextResponse.json({ error: 'すでにキャンセル済みです' }, { status: 409 })
  }

  // キャンセル料計算
  const feeResult = calcCancellationFee(reservation.checkin_date, reservation.total_amount)

  // ステータスを cancelled に更新
  const { error: updateErr } = await supabaseAdmin
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', params.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok:  true,
    fee: feeResult,
  })
}
