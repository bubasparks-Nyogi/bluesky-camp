// app/api/reservations/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/reservations/lookup?id=XXXXXXXX&email=xxx@yyy
 * 部分ID（先頭8文字）＋メールアドレスで予約を照合する（認証不要）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const partialId = searchParams.get('id')?.trim()
  const email     = searchParams.get('email')?.trim().toLowerCase()

  if (!partialId || !email) {
    return NextResponse.json({ error: '予約番号とメールアドレスが必要です' }, { status: 400 })
  }
  if (partialId.length < 6) {
    return NextResponse.json({ error: '予約番号は6文字以上で入力してください' }, { status: 400 })
  }

  // UUIDの先頭部分（ハイフン含む）でフィルタリング
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .filter('id::text', 'ilike', `${partialId}%`)
    .ilike('guest_email', email)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: '予約が見つかりませんでした' }, { status: 404 })

  return NextResponse.json({ reservation: data })
}
