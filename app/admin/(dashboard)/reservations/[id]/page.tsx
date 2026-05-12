// app/admin/(dashboard)/reservations/[id]/page.tsx
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ReservationEditForm from '@/components/admin/ReservationEditForm'
import type { ReservationRow, PricingItem } from '@/types/reservation'

export const metadata = { title: '予約編集 | @blueSky 管理' }

export default async function AdminReservationEditPage({
  params,
}: {
  params: { id: string }
}) {
  const [{ data: reservation }, { data: pricingRows }] = await Promise.all([
    supabaseAdmin.from('reservations').select('*').eq('id', params.id).single(),
    supabaseAdmin.from('pricing').select('*').eq('active', true),
  ])

  if (!reservation) notFound()

  const pricing: PricingItem[] = (pricingRows ?? []).map((p: {
    item_key: string; label: string; amount: number; active: boolean
  }) => ({
    itemKey: p.item_key,
    label:   p.label,
    amount:  p.amount,
    active:  p.active,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-warm-700 font-bold">
          予約編集
        </h1>
        <p className="text-warm-400 text-sm mt-1">
          予約番号: {params.id.slice(0, 8).toUpperCase()}
        </p>
      </div>
      <ReservationEditForm
        reservation={reservation as ReservationRow}
        pricing={pricing}
      />
    </div>
  )
}
