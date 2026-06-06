import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReceiptForReservation, hasReceiptSent } from '@/lib/receipt/sendReceipt'
import type { ReservationRow } from '@/types/reservation'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const { data: candidates } = await supabaseAdmin
    .from('reservations').select('*')
    .eq('status', 'confirmed')
    .lt('checkout_date', today)

  let sent = 0, skipped = 0, failed = 0
  for (const r of (candidates ?? []) as ReservationRow[]) {
    try {
      if (await hasReceiptSent(r.id)) { skipped++; continue }
      await sendReceiptForReservation(r, 'auto')
      sent++
    } catch (e) {
      failed++
      console.error(`receipt send failed for ${r.id}:`, e)
    }
  }
  return NextResponse.json({ scanned: candidates?.length ?? 0, sent, skipped, failed })
}
