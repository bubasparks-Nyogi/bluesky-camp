import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendReceiptForReservation } from '@/lib/receipt/sendReceipt'
import type { ReservationRow } from '@/types/reservation'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: r } = await supabaseAdmin.from('reservations').select('*').eq('id', params.id).maybeSingle()
  if (!r) return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  try {
    const res = await sendReceiptForReservation(r as ReservationRow, 'manual')
    return NextResponse.json({ ok: true, totalAmount: res.totalAmount })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '送信に失敗しました' }, { status: 500 })
  }
}
