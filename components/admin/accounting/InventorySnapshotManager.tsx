'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Snap { id: string; fiscal_year: number; snapshot_type: string; total_value: number; journal_entry_id: string | null; taken_at: string }
const TYPE_LABEL: Record<string, string> = { closing: '期末棚卸', opening: '期首振替' }

export default function InventorySnapshotManager({ initialSnaps }: { initialSnaps: Snap[] }) {
  const router = useRouter()
  const [snaps, setSnaps] = useState(initialSnaps)
  const [year, setYear] = useState(new Date().getFullYear())
  const [type, setType] = useState<'closing' | 'opening'>('closing')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true); setMsg(null); setError(null)
    try {
      const res = await fetch('/api/admin/accounting/inventory-snapshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYear: year, type }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '実行に失敗しました'); return }
      setSnaps(s => [json.snapshot, ...s])
      setMsg(`生成しました（合計 ¥${(json.totalValue ?? 0).toLocaleString()}${json.missingCostCount ? `／原価未設定 ${json.missingCostCount} 件` : ''}）`)
      router.refresh()
    } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('このスナップショットと関連仕訳を取消しますか？')) return
    const res = await fetch(`/api/admin/accounting/inventory-snapshot?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSnaps(s => s.filter(x => x.id !== id))
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-warm-100 rounded-xl p-4">
        <h2 className="font-bold text-warm-700 mb-3">棚卸を実行</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {msg && <p className="text-green-600 text-sm mb-2">{msg}</p>}
        <div className="flex flex-wrap gap-2 items-center">
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm w-24" />
          <select value={type} onChange={e => setType(e.target.value as 'closing' | 'opening')}
            className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm">
            <option value="closing">期末棚卸（12/31）</option>
            <option value="opening">期首振替（1/1）</option>
          </select>
          <button onClick={run} disabled={busy} className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-1.5 rounded-lg text-sm disabled:opacity-40">
            {busy ? '実行中...' : '実行'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {snaps.map(s => (
          <div key={s.id} className="bg-white border border-warm-100 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex gap-2 flex-wrap items-center">
                <span className="font-medium text-warm-700">{s.fiscal_year}年度 {TYPE_LABEL[s.snapshot_type] ?? s.snapshot_type}</span>
                <span className="text-warm-700 font-bold">¥{s.total_value.toLocaleString()}</span>
              </div>
              <p className="text-warm-400 text-xs mt-1">
                {s.journal_entry_id ? `仕訳ID: ${s.journal_entry_id.slice(0, 8)}` : '仕訳なし'} ・ 生成: {new Date(s.taken_at).toLocaleString('ja-JP')}
              </p>
            </div>
            <button onClick={() => remove(s.id)} className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">取消</button>
          </div>
        ))}
        {snaps.length === 0 && <p className="text-warm-400 text-sm">スナップショットはまだありません</p>}
      </div>
    </div>
  )
}
