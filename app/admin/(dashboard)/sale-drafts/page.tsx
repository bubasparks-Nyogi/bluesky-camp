import DraftCard from './DraftCard'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface DraftRow {
  id: string
  reservationId: string
  reservationShortId: string
  guestName: string
  checkinDate: string
  checkoutDate: string
  itemId: string | null
  itemName: string | null
  itemNameRaw: string
  unitPrice: number | null
  quantity: number
  occurredAt: string
  confidence: number
  sourceMessageText: string | null
  sourceMessageReceivedAt: string
  createdAt: string
}

async function fetchDrafts(): Promise<DraftRow[]> {
  const { data } = await supabaseAdmin
    .from('sale_drafts')
    .select(`
      id, reservation_id, item_id, item_name_raw, unit_price, quantity,
      occurred_at, confidence, status, created_at,
      reservations!inner(id, guest_name, checkin_date, checkout_date),
      line_messages!inner(id, text, received_at)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  const itemIds = Array.from(new Set((data ?? []).map(d => d.item_id).filter(Boolean))) as string[]
  let itemsMap: Record<string, string> = {}
  if (itemIds.length > 0) {
    const { data: items } = await supabaseAdmin.from('items').select('id, name').in('id', itemIds)
    itemsMap = Object.fromEntries((items ?? []).map(i => [i.id, i.name]))
  }
  return (data ?? []).map((d: Record<string, unknown>): DraftRow => {
    const r = d.reservations as { id: string; guest_name: string; checkin_date: string; checkout_date: string }
    const m = d.line_messages as { id: string; text: string | null; received_at: string }
    return {
      id: d.id as string,
      reservationId: d.reservation_id as string,
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
      createdAt: d.created_at as string,
    }
  })
}

async function fetchItems() {
  const { data } = await supabaseAdmin
    .from('items').select('id, name, sale_price')
    .eq('is_sellable', true).eq('is_active', true).order('name')
  return (data ?? []) as { id: string; name: string; sale_price: number | null }[]
}

export default async function SaleDraftsPage() {
  const [drafts, items] = await Promise.all([fetchDrafts(), fetchItems()])
  return (
    <main className="min-h-screen bg-warm-50 p-4">
      <div className="max-w-md mx-auto space-y-3">
        <h1 className="text-warm-700 font-serif text-2xl">📋 未承認の抽出案</h1>
        <p className="text-warm-400 text-xs">{drafts.length} 件</p>
        {drafts.length === 0 ? (
          <p className="text-warm-400 text-sm py-10 text-center">未承認の抽出案はありません</p>
        ) : (
          drafts.map(d => <DraftCard key={d.id} draft={d} items={items} />)
        )}
      </div>
    </main>
  )
}
