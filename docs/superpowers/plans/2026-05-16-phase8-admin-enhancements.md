# Phase 8 管理パネル強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理パネルに今月の統計バーと予約一覧の検索・フィルター機能を追加する。

**Architecture:** 統計は専用 API エンドポイント `GET /api/admin/stats?month=YYYY-MM` を新設し、クライアントコンポーネント `StatsBar` から取得してダッシュボード上部に表示する。検索・フィルターは既存 `ReservationList.tsx` に `useMemo` ベースのクライアントサイドフィルタを追加するだけで、API の変更は不要。

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`supabaseAdmin` + `createSupabaseServerClient`), TailwindCSS (warm palette), Vitest

---

## ファイルマップ

```
app/api/admin/stats/route.ts            新規: 統計APIエンドポイント
components/admin/StatsBar.tsx           新規: 統計バーコンポーネント（'use client'）
app/admin/(dashboard)/page.tsx          変更: StatsBar を追加
components/admin/ReservationList.tsx    変更: フィルターUI + filteredList を追加
```

---

## Task 1: 統計 API `GET /api/admin/stats`

**Files:**
- Create: `app/api/admin/stats/route.ts`

- [ ] **Step 1: `app/api/admin/stats/route.ts` を作成**

```typescript
// app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/admin/stats?month=YYYY-MM
 * 指定月の予約件数・売上合計・稼働率を返す
 */
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month パラメーターが必要です（形式: YYYY-MM）' }, { status: 400 })
  }

  const year      = Number(month.slice(0, 4))
  const monthNum  = Number(month.slice(5, 7))
  const firstDay  = `${month}-01`
  // その月の最終日（new Date(year, monthNum, 0) = 前月末 = 当月末）
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const lastDay   = `${month}-${String(daysInMonth).padStart(2, '0')}`

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('total_amount')
    .neq('status', 'cancelled')
    .gte('checkin_date', firstDay)
    .lte('checkin_date', lastDay)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows    = data ?? []
  const count   = rows.length
  const revenue = rows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)
  const occupancy = daysInMonth > 0 ? count / daysInMonth : 0

  return NextResponse.json({ count, revenue, occupancy })
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 3: コミット**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
git add app/api/admin/stats/route.ts
git commit -m "feat: 管理パネル 統計API GET /api/admin/stats を追加"
```

---

## Task 2: StatsBar コンポーネント

**Files:**
- Create: `components/admin/StatsBar.tsx`

- [ ] **Step 1: `components/admin/StatsBar.tsx` を作成**

```typescript
// components/admin/StatsBar.tsx
'use client'
import { useState, useEffect } from 'react'

interface StatsData {
  count:     number
  revenue:   number
  occupancy: number
}

export default function StatsBar() {
  const [stats,   setStats]   = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    fetch(`/api/admin/stats?month=${month}`)
      .then(r => r.json())
      .then((data: StatsData) => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const cards = stats
    ? [
        { icon: '📅', label: '今月の予約件数', value: `${stats.count}件` },
        { icon: '💴', label: '今月の売上合計', value: `¥${stats.revenue.toLocaleString()}` },
        { icon: '📊', label: '今月の稼働率',   value: `${Math.round(stats.occupancy * 100)}%` },
      ]
    : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {loading || !cards
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-warm-200 animate-pulse">
              <div className="h-4 bg-warm-100 rounded w-1/2 mb-3" />
              <div className="h-7 bg-warm-100 rounded w-2/3" />
            </div>
          ))
        : cards.map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 border border-warm-200">
              <p className="text-xs text-warm-400 mb-1 flex items-center gap-1">
                <span>{card.icon}</span>
                <span>{card.label}</span>
              </p>
              <p className="text-2xl font-bold text-warm-700">{card.value}</p>
            </div>
          ))
      }
    </div>
  )
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 3: コミット**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
git add components/admin/StatsBar.tsx
git commit -m "feat: 管理パネル StatsBar コンポーネント追加"
```

---

## Task 3: ダッシュボードページに StatsBar を追加

**Files:**
- Modify: `app/admin/(dashboard)/page.tsx`

現在の内容:
```typescript
import ReservationCalendar from '@/components/admin/ReservationCalendar'
export const metadata = { title: '予約カレンダー | @blueSky 管理' }
export default function AdminPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">予約カレンダー</h1>
      <ReservationCalendar />
    </div>
  )
}
```

- [ ] **Step 1: `app/admin/(dashboard)/page.tsx` を更新**

```typescript
// app/admin/(dashboard)/page.tsx
import ReservationCalendar from '@/components/admin/ReservationCalendar'
import StatsBar from '@/components/admin/StatsBar'

export const metadata = { title: '予約カレンダー | @blueSky 管理' }

export default function AdminPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">予約カレンダー</h1>
      <StatsBar />
      <ReservationCalendar />
    </div>
  )
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 3: ローカルで確認**

```bash
npm run dev
# http://localhost:3000/admin を開き、カレンダー上部に3枚の統計カードが表示されることを確認
# ローディング中はスケルトンアニメーションが表示されること
```

- [ ] **Step 4: コミット**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
git add app/admin/(dashboard)/page.tsx
git commit -m "feat: 管理パネル ダッシュボードに統計バーを追加"
```

---

## Task 4: 予約一覧に検索・フィルター追加

**Files:**
- Modify: `components/admin/ReservationList.tsx`

- [ ] **Step 1: `components/admin/ReservationList.tsx` をフィルター対応版に置き換える**

ファイル全体を以下の内容に差し替える:

```typescript
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
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build
```

Expected: ビルドエラーなし

- [ ] **Step 3: 全テストが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm test
```

Expected: 全テスト PASS（既存31件）

- [ ] **Step 4: ローカルで動作確認**

```bash
npm run dev
# 1. http://localhost:3000/admin/reservations を開く
# 2. ステータスドロップダウンで「確定」を選ぶ → 絞り込まれることを確認
# 3. 日付範囲を入力 → 絞り込まれることを確認
# 4. ゲスト名を部分入力 → 絞り込まれることを確認
# 5. 「リセット」ボタンで全件に戻ることを確認
# 6. フィルター中は「X件 / 全Y件」の表示が出ることを確認
```

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
git add components/admin/ReservationList.tsx
git commit -m "feat: 予約一覧に検索・フィルター機能を追加（ステータス・日付範囲・ゲスト名）"
```

---

## 全体確認

- [ ] **最終ビルド + テスト**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build && npm test
```

Expected: ビルドエラーなし・全テスト PASS

- [ ] **ローカルでE2E確認**

```bash
npm run dev
# 1. /admin → 統計バー（件数・売上・稼働率）が表示される
# 2. /admin → カレンダー上部に3枚カード。ローディング中はスケルトン表示
# 3. /admin/reservations → フィルターUIが表示される
# 4. 各フィルターが正常に動作する
# 5. フィルター後に「リセット」で全件表示に戻る
```
