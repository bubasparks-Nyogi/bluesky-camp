// app/reserve/lookup/[id]/CancelModalWrapper.tsx
'use client'
import { useState } from 'react'
import CancelModal from '@/components/reserve/CancelModal'
import type { CancellationFeeResult } from '@/lib/cancellation'

interface Props {
  reservationId: string
  guestEmail:    string
  checkinDate:   string
  totalAmount:   number
  feeResult:     CancellationFeeResult
}

export default function CancelModalWrapper(props: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-red-300 text-red-500 hover:bg-red-50
                   font-bold py-3 rounded-xl text-sm transition-colors"
      >
        キャンセルする
      </button>
      {open && (
        <CancelModal
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
