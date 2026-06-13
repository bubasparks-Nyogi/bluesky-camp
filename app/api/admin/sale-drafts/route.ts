import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reservationId = req.nextUrl.searchParams.get('reservationId')

  let query = supabaseAdmin
    .from('sale_drafts')
    .select(`
      id, reservation_id, item_id, item_name_raw, unit_price, quantity,
      occurred_at, confidence, status, created_at,
      reservations!inner(id, guest_name, checkin_date, checkout_date),
      line_messages!inner(id, text, received_at)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (reservationId) query = query.eq('reservation_id', reservationId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const itemIds = Array.from(new Set((data ?? []).map(d => d.item_id).filter(Boolean))) as string[]
  let itemsMap: Record<string, string> = {}
  if (itemIds.length > 0) {
    const { data: items } = await supabaseAdmin.from('items').select('id, name').in('id', itemIds)
    itemsMap = Object.fromEntries((items ?? []).map(i => [i.id, i.name]))
  }

  const drafts = (data ?? []).map(d => {
    const r = (d as unknown as { reservations: { id: string; guest_name: string; checkin_date: string; checkout_date: string } }).reservations
    const m = (d as unknown as { line_messages: { id: string; text: string | null; received_at: string } }).line_messages
    return {
      id: d.id,
      reservationId: d.reservation_id,
      reservationShortId: r.id.slice(0, 8).toUpperCase(),
      guestName: r.guest_name,
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
      itemId: d.item_id,
      itemName: d.item_id ? (itemsMap[d.item_id] ?? null) : null,
      itemNameRaw: d.item_name_raw,
      unitPrice: d.unit_price,
      quantity: Number(d.quantity),
      occurredAt: d.occurred_at,
      confidence: Number(d.confidence),
      sourceMessageText: m.text,
      sourceMessageReceivedAt: m.received_at,
      createdAt: d.created_at,
    }
  })

  return NextResponse.json({ drafts })
}
