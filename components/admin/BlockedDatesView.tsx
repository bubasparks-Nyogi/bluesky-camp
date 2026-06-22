'use client'
import { useState } from 'react'
import BlockedDatesCalendar, { type BlockedRow, type ReservedRow } from './BlockedDatesCalendar'

interface Props {
  blocked: BlockedRow[]
  reserved: ReservedRow[]
}

async function addBlock(date: string, reason: string | null): Promise<{ ok: boolean; row?: BlockedRow; error?: string }> {
  const res = await fetch('/api/admin/blocked-dates', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, reason }),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false, error: data.error ?? '追加失敗' }
  return { ok: true, row: data.blocked as BlockedRow }
}

async function removeBlock(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error ?? '解除失敗' }
  }
  return { ok: true }
}

export default function BlockedDatesView({ blocked: initialBlocked, reserved }: Props) {
  const [mode, setMode] = useState<'calendar' | 'list'>('calendar')
  const [blocked, setBlocked] = useState<BlockedRow[]>(initialBlocked)
  const [removing, setRemoving] = useState<string | null>(null)
  const [date,   setDate]   = useState('')
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg,    setMsg]    = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  const onAddCalendar = async (d: string, r: string | null) => {
    const result = await addBlock(d, r)
    if (result.ok && result.row) setBlocked(prev => [...prev, result.row!].sort((a, b) => a.date.localeCompare(b.date)))
    return result
  }
  const onRemoveCalendar = async (id: string) => {
    const result = await removeBlock(id)
    if (result.ok) setBlocked(prev => prev.filter(b => b.id !== id))
    return result
  }

  const onAddList = async () => {
    if (!date) return
    setAdding(true)
    const result = await addBlock(date, reason || null)
    setAdding(false)
    if (result.ok && result.row) {
      setBlocked(prev => [...prev, result.row!].sort((a, b) => a.date.localeCompare(b.date)))
      setDate(''); setReason('')
      flash('ブロックしました')
    } else {
      flash(result.error ?? 'エラー')
    }
  }
  const onRemoveList = async (id: string) => {
    setRemoving(id)
    const result = await removeBlock(id)
    setRemoving(null)
    if (result.ok) {
      setBlocked(prev => prev.filter(b => b.id !== id))
      flash('解除しました')
    } else flash(result.error ?? 'エラー')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setMode('calendar')}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold ${mode === 'calendar' ? 'bg-warm-500 text-white' : 'bg-warm-100 text-warm-600'}`}>
          📅 カレンダー
        </button>
        <button onClick={() => setMode('list')}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold ${mode === 'list' ? 'bg-warm-500 text-white' : 'bg-warm-100 text-warm-600'}`}>
          📋 リスト
        </button>
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">{msg}</div>}

      {mode === 'calendar' ? (
        <BlockedDatesCalendar
          blocked={blocked}
          reserved={reserved}
          onAdd={onAddCalendar}
          onRemove={onRemoveCalendar}
        />
      ) : (
        <>
          <div className="p-5 bg-white border border-warm-200 rounded-xl">
            <h3 className="font-medium text-warm-700 mb-4 text-sm">日程をブロック</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-warm-400 mb-1">日付</label>
                <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)}
                  className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400" />
              </div>
              <div>
                <label className="block text-xs text-warm-400 mb-1">理由（任意）</label>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="例：メンテナンス"
                  className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400 w-40" />
              </div>
              <button onClick={onAddList} disabled={adding || !date}
                className="bg-warm-600 hover:bg-warm-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-lg">
                {adding ? '追加中...' : '🚫 ブロック'}
              </button>
            </div>
          </div>
          <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-warm-100 text-sm font-medium text-warm-600">
              ブロック一覧（{blocked.length}件）
            </div>
            {blocked.length === 0 ? (
              <p className="px-5 py-6 text-center text-warm-400 text-sm">ブロックされた日程はありません</p>
            ) : (
              <div className="divide-y divide-warm-100">
                {blocked.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <span className="font-medium text-warm-700 text-sm">{b.date}</span>
                      {b.reason && <span className="ml-3 text-xs text-warm-400">{b.reason}</span>}
                    </div>
                    <button onClick={() => onRemoveList(b.id)} disabled={removing === b.id}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-3 py-1 rounded-lg disabled:opacity-50">
                      {removing === b.id ? '...' : '解除'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
