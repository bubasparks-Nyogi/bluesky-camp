'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckinButton({ reservationId, alreadyChecked }: { reservationId: string; alreadyChecked: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(alreadyChecked)

  const submit = async () => {
    setBusy(true); setErr(null)
    const res = await fetch(`/api/admin/checkin/${reservationId}`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? 'エラーが発生しました'); return }
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <p className="text-3xl">✅</p>
        <p className="text-green-700 font-bold mt-2">チェックイン完了</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {err && <p className="text-red-500 text-sm">{err}</p>}
      <button onClick={submit} disabled={busy}
        className="w-full bg-warm-500 hover:bg-warm-600 disabled:opacity-60 text-white font-bold py-4 rounded-lg text-lg">
        {busy ? '処理中...' : '✅ チェックイン完了として記録'}
      </button>
    </div>
  )
}
