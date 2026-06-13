// app/admin/(dashboard)/reservations/[id]/page.tsx
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ReservationEditForm from '@/components/admin/ReservationEditForm'
import SaleLinesEditor from '@/components/admin/sales/SaleLinesEditor'
import ReservationDraftsSection from './ReservationDraftsSection'
import type { ReservationRow, PricingItem } from '@/types/reservation'

export const metadata = { title: '予約編集 | @blueSky 管理' }
export const revalidate = 0

export default async function AdminReservationEditPage({ params }: { params: { id: string } }) {
  const [{ data: reservation }, { data: pricingRows }, { data: saleLines }, { data: items }, { data: logs }] = await Promise.all([
    supabaseAdmin.from('reservations').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('pricing').select('*').eq('active', true),
    supabaseAdmin.from('sale_lines').select('id, item_id, item_name, unit_price, quantity, occurred_at, note').eq('reservation_id', params.id).order('occurred_at').order('created_at'),
    supabaseAdmin.from('items').select('id, name, sale_price').eq('is_sellable', true).eq('is_active', true).order('category').order('name'),
    supabaseAdmin.from('receipt_logs').select('id, type, trigger, sent_at').eq('reservation_id', params.id).eq('type', 'receipt').order('sent_at', { ascending: false }).limit(1),
  ])

  if (!reservation) notFound()

  const pricing: PricingItem[] = (pricingRows ?? []).map((p: { item_key: string; label: string; amount: number; active: boolean }) => ({
    itemKey: p.item_key, label: p.label, amount: p.amount, active: p.active,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-warm-700 font-bold">予約編集</h1>
        <p className="text-warm-400 text-sm mt-1">予約番号: {params.id.slice(0, 8).toUpperCase()}</p>
      </div>
      <ReservationEditForm reservation={reservation as ReservationRow} pricing={pricing} />
      <SaleLinesEditor
        reservationId={params.id}
        initialSaleLines={(saleLines ?? []).map(s => ({ ...s, quantity: Number(s.quantity) }))}
        sellableItems={items ?? []}
        lastReceiptLog={logs?.[0] ?? null}
      />
      <ReservationDraftsSection reservationId={params.id} />
    </div>
  )
}
