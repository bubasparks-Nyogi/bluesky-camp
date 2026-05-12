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
import StepTerms    from './StepTerms'
import StepConfirm   from './StepConfirm'
import StepPayment   from './StepPayment'
const INITIAL: ReservationFormData = { checkinDate: '', checkoutDate: '', stayType: 'tent', ehu: false, sauna: false, pet: false, transferCount: 0, transferStation: '', rentalItems: [], guestName: '', guestEmail: '', guestPhone: '' }
export default function ReserveFlow() {
  const [step, setStep] = useState<StepIndex>(0)
  const [form, setForm] = useState<ReservationFormData>(INITIAL)
  const update = (u: Partial<ReservationFormData>) => setForm(f => ({ ...f, ...u }))
  const next = () => setStep(s => (s + 1) as StepIndex)
  const back = () => setStep(s => (s - 1) as StepIndex)
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
    <StepPayment   key={9} form={form} onBack={back} />,
  ]
  return (
    <div className="max-w-lg mx-auto px-4 py-10 min-h-screen">
      <div className="mb-8">
        <div className="flex justify-between text-xs text-warm-400 mb-2"><span>STEP {step + 1} / {STEP_LABELS.length}</span><span>{STEP_LABELS[step]}</span></div>
        <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
          <div className="h-full bg-warm-300 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }} />
        </div>
      </div>
      {steps[step]}
    </div>
  )
}
