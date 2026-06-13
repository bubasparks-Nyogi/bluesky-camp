import { supabaseAdmin } from '@/lib/supabase'
import DraftCard from '../../sale-drafts/DraftCard'

export default async function ReservationDraftsSection({ reservationId }: { reservationId: string }) {
  const { data: drafts } = await supabaseAdmin
    .from('sale_drafts')
    .select(`
      id, reservation_id, item_id, item_name_raw, unit_price, quantity,
      occurred_at, confidence, status, created_at,
      reservations!inner(id, guest_name, checkin_date, checkout_date),
      line_messages!inner(id, text, received_at)
    `)
    .eq('reservation_id', reservationId).eq('status', 'pending')
    .order('created_at', { ascending: false })

  const itemIds = Array.from(new Set((drafts ?? []).map(d => d.item_id).filter(Boolean))) as string[]
  let itemsMap: Record<string, string> = {}
  if (itemIds.length > 0) {
    const { data: itemsForMap } = await supabaseAdmin.from('items').select('id, name').in('id', itemIds)
    itemsMap = Object.fromEntries((itemsForMap ?? []).map(i => [i.id, i.name]))
  }
  const { data: items } = await supabaseAdmin
    .from('items').select('id, name, sale_price')
    .eq('is_sellable', true).eq('is_active', true).order('name')

  const cards = (drafts ?? []).map((d: Record<string, unknown>) => {
    const r = d.reservations as { id: string; guest_name: string; checkin_date: string; checkout_date: string }
    const m = d.line_messages as { id: string; text: string | null; received_at: string }
    return {
      id: d.id as string,
      reservationShortId: r.id.slice(0, 8).toUpperCase(),
      guestName: r.guest_name,
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
      itemId: (d.item_id as string | null) ?? null,
      itemName: d.item_id ? (itemsMap[d.item_id as string] ?? null) : null,
      itemNameRaw: d.item_name_raw as string,
      unitPrice: (d.unit_price as number | null) ?? null,
      quantity: Number(d.quantity),
      occurredAt: d.occurred_at as string,
      confidence: Number(d.confidence),
      sourceMessageText: m.text,
      sourceMessageReceivedAt: m.received_at,
    }
  })

  if (cards.length === 0) return null

  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-warm-700 font-bold">📋 未承認の抽出案 ({cards.length}件)</h2>
      {cards.map(c => <DraftCard key={c.id} draft={c} items={(items ?? []) as { id: string; name: string; sale_price: number | null }[]} />)}
    </section>
  )
}
