import { notFound, redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ReserveFlow from '@/components/reserve/ReserveFlow'
import type { ReservationFormData, ReservationRow, StayType } from '@/types/reservation'

export const dynamic = 'force-dynamic'

export default async function EditReservationPage({ params }: { params: { id: string } }) {
  const { data: r } = await supabaseAdmin
    .from('reservations').select('*').eq('id', params.id).maybeSingle()
  if (!r) notFound()
  const reservation = r as ReservationRow

  if (reservation.status === 'cancelled') {
    redirect(`/reserve/lookup/${params.id}`)
  }
  const today = new Date().toISOString().slice(0, 10)
  if (reservation.checkin_date < today) {
    redirect(`/reserve/lookup/${params.id}`)
  }

  const stayTypes: StayType[] = Array.isArray(reservation.stay_types) && reservation.stay_types.length
    ? reservation.stay_types as StayType[]
    : [reservation.stay_type as StayType]

  const initial: ReservationFormData = {
    checkinDate:     reservation.checkin_date,
    checkoutDate:    reservation.checkout_date,
    stayTypes,
    ehu:             reservation.ehu,
    sauna:           reservation.sauna,
    pet:             reservation.pet,
    transferCount:   reservation.transfer_count,
    transferStation: reservation.transfer_station ?? '',
    rentalItems:     (reservation.rental_items ?? []) as ReservationFormData['rentalItems'],
    guestName:       reservation.guest_name,
    guestEmail:      reservation.guest_email,
    guestPhone:      reservation.guest_phone,
  }

  return (
    <ReserveFlow editMode={{
      reservationId: reservation.id,
      initial,
      oldTotal: reservation.total_amount,
    }} />
  )
}
