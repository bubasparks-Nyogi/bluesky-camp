'use client'
import { useState } from 'react'
import type { ReservationFormData, StepIndex } from '@/types/reservation'
import { STEP_LABELS } from '@/types/reservation'
import StepDate      from './StepDate'
import StepStayType  from './StepStayType'
import StepSauna     from './StepSauna'
import StepPet       from './StepPet'
import StepTransfer  from './StepTransfer'
import StepRental    from './StepRental'
import StepGuestInfo from './StepGuestInfo'
import StepTerms     from './StepTerms'
import StepConfirm   from './StepConfirm'
import StepPayment   from './StepPayment'
import StepEditSubmit from './StepEditSubmit'

interface Props {
  initialDate?: string
  editMode?: {
    reservationId: string
    initial: ReservationFormData
    oldTotal: number
  }
}

function buildInitial(initialDate?: string): ReservationFormData {
  if (!initialDate) {
    return {
      checkinDate: '', checkoutDate: '', stayTypes: [], ehu: false,
      sauna: false, pet: false, transferCount: 0, transferStation: '',
      rentalItems: [], guestName: '', guestEmail: '', guestPhone: '',
    }
  }
  const next = new Date(initialDate)
  next.setDate(next.getDate() + 1)
  return {
    checkinDate: initialDate,
    checkoutDate: next.toISOString().slice(0, 10),
    stayTypes: [], ehu: false, sauna: false, pet: false,
    transferCount: 0, transferStation: '',
    rentalItems: [], guestName: '', guestEmail: '', guestPhone: '',
  }
}

export default function ReserveFlow({ initialDate, editMode }: Props) {
  const [step, setStep] = useState<StepIndex>(editMode ? 0 : (initialDate ? 1 : 0))
  const [form, setForm] = useState<ReservationFormData>(() => editMode ? editMode.initial : buildInitial(initialDate))
  const update = (u: Partial<ReservationFormData>) => setForm(f => ({ ...f, ...u }))
  const next = () => setStep(s => (s + 1) as StepIndex)
  const back = () => setStep(s => (s - 1) as StepIndex)

  const lastStep = editMode
    ? <StepEditSubmit key={9} form={form} reservationId={editMode.reservationId} oldTotal={editMode.oldTotal} onBack={back} />
    : <StepPayment   key={9} form={form} onBack={back} />

  const steps = [
    <StepDate key={0} form={form} onChange={update} onNext={next} />,
    <StepStayType key={1} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepSauna key={2} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepPet key={3} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepTransfer key={4} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepRental key={5} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepGuestInfo key={6} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepTerms     key={7} onNext={next} onBack={back} />,
    <StepConfirm   key={8} form={form} onNext={next} onBack={back} />,
    lastStep,
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-10 min-h-screen">
      {editMode && (
        <div className="bg-warm-100 text-warm-700 text-sm px-4 py-2 rounded-lg mb-4 text-center">
          📝 予約を変更しています（予約番号: {editMode.reservationId.slice(0, 8).toUpperCase()}）
        </div>
      )}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-warm-400 mb-2">
          <span>STEP {step + 1} / {STEP_LABELS.length}</span>
          <span>{STEP_LABELS[step]}</span>
        </div>
        <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-warm-300 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>
      {steps[step]}
    </div>
  )
}
