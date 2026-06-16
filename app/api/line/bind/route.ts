import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyIdToken } from '@/lib/line/verifyIdToken'
import { memoryRateLimit } from '@/lib/security/rateLimit'

export async function POST(req: NextRequest) {
  // N-6: 同一IP 15分10回まで
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (memoryRateLimit(`line-bind:${ip}`, 15 * 60 * 1000, 10)) {
    return NextResponse.json(
      { error: '短時間に多数のリクエストを受信しました。しばらくお待ちください。' },
      { status: 429 },
    )
  }

  let body: { reservationId?: string; lineUserId?: string; idToken?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { reservationId, lineUserId, idToken } = body
  if (!reservationId || !lineUserId || !idToken)
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId)
    return NextResponse.json({ error: 'サーバ設定不備（CHANNEL_ID 未設定）' }, { status: 500 })

  const sub = await verifyIdToken(idToken, channelId)
  if (!sub || sub !== lineUserId)
    return NextResponse.json({ error: 'idToken 検証に失敗しました' }, { status: 401 })

  const { data: r } = await supabaseAdmin
    .from('reservations').select('id, checkin_date').eq('id', reservationId).maybeSingle()
  if (!r) return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const thirty = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  if (r.checkin_date < thirty)
    return NextResponse.json({ error: '古い予約のため連携できません' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('reservations').update({ line_user_id: lineUserId }).eq('id', reservationId)
  if (error) return NextResponse.json({ error: 'DB エラー' }, { status: 500 })

  return NextResponse.json({ ok: true, today })
}
