'use client'
import { useState } from 'react'

interface BlockedRow { id: string; date: string; reason: string | null; created_at: string }

interface Props { blocked: BlockedRow[] }

export default function BlockedDatesForm({ blocked: initial }: Props) {
  const [list,     setList]     = useState<BlockedRow[]>(initial)
  const [date,     setDate]     = useState('')
  const [reason,   setReason]   = useState('')
  const [adding,   setAdding]   = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [message,  setMessage]  = useState<string | null>(null)

  const flash = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 3000) }

  const handleAdd = async () => {
    if (!date) return
    setAdding(true)
    const res  = await fetch('/api/admin/blocked-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, reason: reason || null }),
    })
    const data = await res.json()
    if (res.ok) {
      setList(prev => [...prev, data.blocked].sort((a, b) => a.date.localeCompare(b.date)))
      setDate(''); setReason('')
      flash('ブロックしました')
    } else {
      flash(data.error ?? 'エラーが発生しました')
    }
    setAdding(false)
  }

  const handleRemove = async (id: string) => {
    setRemoving(id)
    const res = await fetch(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setList(prev => prev.filter(b => b.id !== id))
      flash('解除しました')
    } else {
      flash('解除に失敗しました')
    }
    setRemoving(null)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">{message}</div>
      )}

      {/* 新規ブロック */}
      <div className="p-5 bg-white border border-warm-200 rounded-xl">
        <h3 className="font-medium text-warm-700 mb-4 text-sm">日程をブロック</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-warm-400 mb-1">日付</label>
            <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)}
                   className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                              focus:outline-none focus:border-warm-400" />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">理由（任意）</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
                   placeholder="例：メンテナンス"
                   className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                              focus:outline-none focus:border-warm-400 w-40" />
          </div>
          <button onClick={handleAdd} disabled={adding || !date}
                  className="bg-warm-600 hover:bg-warm-700 disabled:opacity-60 text-white text-sm
                             font-bold px-4 py-2 rounded-lg transition-colors">
            {adding ? '追加中...' : '🚫 ブロック'}
          </button>
        </div>
      </div>

      {/* ブロック一覧 */}
      <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-warm-100 text-sm font-medium text-warm-600">
          ブロック一覧（{list.length}件）
        </div>
        {list.length === 0 ? (
          <p className="px-5 py-6 text-center text-warm-400 text-sm">ブロックされた日程はありません</p>
        ) : (
          <div className="divide-y divide-warm-100">
            {list.map(b => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-medium text-warm-700 text-sm">{b.date}</span>
                  {b.reason && <span className="ml-3 text-xs text-warm-400">{b.reason}</span>}
                </div>
                <button onClick={() => handleRemove(b.id)} disabled={removing === b.id}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-200
                                   px-3 py-1 rounded-lg disabled:opacity-50">
                  {removing === b.id ? '...' : '解除'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
