// components/admin/ReservationList.tsx
'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ReservationRow } from '@/types/reservation'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー',
}

const STATUS_OPTIONS = [
  { value: '',          label: 'すべて' },
  { value: 'pending',   label: '確認中' },
  { value: 'confirmed', label: '確定' },
  { value: 'cancelled', label: 'キャンセル済み' },
]

export default function ReservationList({ reservations: initial }: { reservations: ReservationRow[] }) {
  const router = useRouter()
  const [list,     setList]     = useState<ReservationRow[]>(initial)
  const [selected, setSelected] = useState<ReservationRow | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  // フィルター state
  const [statusFilter, setStatusFilter] = useState('')
  const [fromFilter,   setFromFilter]   = useState('')
  const [toFilter,     setToFilter]     = useState('')
  const [nameFilter,   setNameFilter]   = useState('')

  const filteredList = useMemo(() => list.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false
    if (fromFilter   && r.checkin_date < fromFilter) return false
    if (toFilter     && r.checkin_date > toFilter)   return false
    if (nameFilter   && !r.guest_name.toLowerCase().includes(nameFilter.toLowerCase())) return false
    return true
  }), [list, statusFilter, fromFilter, toFilter, nameFilter])

  const resetFilters = () => {
    setStatusFilter('')
    setFromFilter('')
    setToFilter('')
    setNameFilter('')
  }

  const hasFilter = statusFilter || fromFilter || toFilter || nameFilter

  const handleCancel = async (id: string) => {
    setUpdating(id)
    await fetch(`/api/admin/reservations/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    setList(l => l.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
    setUpdating(null)
  }

  const stayLabel = (r: ReservationRow) => {
    const types = (r as any).stay_types as string[] | undefined
    if (types && types.length > 0) return types.map(t => STAY_LABELS[t] ?? t).join('・')
    return STAY_LABELS[r.stay_type] ?? r.stay_type
  }

  return (
    <div>
      {/* フィルターUI */}
      <div className="bg-warm-50 border border-warm-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* ステータス */}
          <div>
            <label className="block text-xs text-warm-400 mb-1">ステータス</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                         bg-white focus:outline-none focus:border-warm-400"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* チェックイン日 From */}
          <div>
            <label className="block text-xs text-warm-400 mb-1">チェックイン From</label>
            <input
              type="date"
              value={fromFilter}
              onChange={e => setFromFilter(e.target.value)}
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                         bg-white focus:outline-none focus:border-warm-400"
            />
          </div>

          {/* チェックイン日 To */}
          <div>
            <label className="block text-xs text-warm-400 mb-1">チェックイン To</label>
            <input
              type="date"
              value={toFilter}
              onChange={e => setToFilter(e.target.value)}
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                         bg-white focus:outline-none focus:border-warm-400"
            />
          </div>

          {/* ゲスト名 */}
          <div>
            <label className="block text-xs text-warm-400 mb-1">ゲスト名</label>
            <input
              type="text"
              placeholder="名前で検索..."
              value={nameFilter}
              onChange={e => setNameFilter(e.target.value)}
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                         bg-white focus:outline-none focus:border-warm-400 w-36"
            />
          </div>

          {/* リセットボタン */}
          {hasFilter && (
            <button
              onClick={resetFilters}
              className="text-xs text-warm-400 hover:text-warm-600 border border-warm-200
                         bg-white px-3 py-2 rounded-lg transition-colors"
            >
              リセット
            </button>
          )}
        </div>

        {hasFilter && (
          <p className="text-xs text-warm-400 mt-2">
            {filteredList.length}件 / 全{list.length}件
          </p>
        )}
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-xl border border-warm-200">
        <table className="w-full text-sm">
          <thead className="bg-warm-100 text-warm-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">日程</th>
              <th className="px-4 py-3 text-left font-medium">お客様名</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">宿泊タイプ</th>
              <th className="px-4 py-3 text-right font-medium hidden md:table-cell">合計</th>
              <th className="px-4 py-3 text-left font-medium">ステータス</th>
              <th className="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map(r => (
              <tr key={r.id} className="border-t border-warm-100 hover:bg-warm-50 cursor-pointer"
                  onClick={() => setSelected(r)}>
                <td className="px-4 py-3 text-warm-700">{r.checkin_date}</td>
                <td className="px-4 py-3 text-warm-700">{r.guest_name}</td>
                <td className="px-4 py-3 text-warm-500 hidden md:table-cell">{stayLabel(r)}</td>
                <td className="px-4 py-3 text-warm-500 text-right hidden md:table-cell">
                  ¥{r.total_amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                    ${r.status === 'confirmed' ? 'bg-green-100 text-green-700'   : ''}
                    ${r.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${r.status === 'cancelled' ? 'bg-red-100 text-red-400'       : ''}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  {r.status !== 'cancelled' && (
                    <button
                      disabled={updating === r.id}
                      onClick={() => handleCancel(r.id)}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50
                                 border border-red-200 px-2 py-1 rounded"
                    >
                      {updating === r.id ? '...' : 'キャンセル'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredList.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-warm-400">
                  {hasFilter ? '条件に一致する予約がありません' : '予約がありません'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 詳細モーダル */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
             onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full overflow-y-auto max-h-[80vh]"
               onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-warm-700 mb-4">予約詳細</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {([
                ['予約番号',     selected.id.slice(0, 8)],
                ['チェックイン', selected.checkin_date],
                ['チェックアウト', selected.checkout_date],
                ['お客様名',     selected.guest_name],
                ['メール',       selected.guest_email],
                ['電話',         selected.guest_phone],
                ['宿泊タイプ',   stayLabel(selected)],
                ['サウナ',       selected.sauna ? '利用' : 'なし'],
                ['ペット',       selected.pet    ? '同伴' : 'なし'],
                ['送迎',         selected.transfer_count > 0
                  ? `${selected.transfer_count}名 (${selected.transfer_station})`
                  : 'なし'],
                ['合計金額',     `¥${selected.total_amount.toLocaleString()}`],
                ['ステータス',   selected.status],
              ] as [string, string][]).map(([k, v]) => (
                <>
                  <dt key={`dt-${k}`} className="text-warm-400">{k}</dt>
                  <dd key={`dd-${k}`} className="text-warm-700">{v}</dd>
                </>
              ))}
            </dl>
            <button
              onClick={() => { router.push(`/admin/reservations/${selected.id}`); setSelected(null) }}
              className="mt-5 w-full bg-warm-300 hover:bg-warm-400 text-white font-bold py-2 rounded-lg text-sm"
            >
              ✏️ 編集する
            </button>
            <button
              onClick={() => setSelected(null)}
              className="mt-2 w-full bg-warm-100 hover:bg-warm-200 text-warm-600 font-bold py-2 rounded-lg text-sm"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
