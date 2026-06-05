# サブプロジェクト B-2：在庫管理 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在庫数量を履歴台帳＋現在数量キャッシュで管理し、入庫・廃棄・棚卸調整を管理画面から記録・閲覧できる在庫管理機能を追加する。

**Architecture:** 純粋ロジック（数量合計・動きの delta 算出＋検証）を `lib/inventory/` に TDD で実装し、その上に `stock_movements` テーブル＋`items.current_quantity` キャッシュ・admin API・在庫管理UIを載せる。仕訳は作らない（数量のみ）。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin + RLS), TypeScript, Vitest, TailwindCSS warm palette。

**参照スペック:** `docs/superpowers/specs/2026-05-20-B2-inventory-design.md`

---

## 前提知識（実装者向け）
- B-1 で `items` テーブルあり（`track_inventory boolean`, `unit`, `category`, `name`, `is_active`）。
- admin API: `createSupabaseServerClient()`（`@/lib/supabase-server`）で `auth.getUser()` → user 無ければ 401。`supabaseAdmin`（`@/lib/supabase`）で DML。
- admin ページは `app/admin/(dashboard)/`。ナビ配列は `app/admin/(dashboard)/layout.tsx`。
- 数量は小数可（numeric）。シェルは Bash（Git Bash）。パス `C:/Users/biscu/Downloads/bluesky-camp`。既存テスト総数 143。

---

### Task 1: 型 + `computeQuantity`

**Files:**
- Create: `lib/inventory/types.ts`
- Create: `lib/inventory/quantity.ts`
- Test: `lib/inventory/__tests__/quantity.test.ts`

- [ ] **Step 1: `lib/inventory/types.ts` を作成**

```typescript
export type MovementType = 'in' | 'disposal' | 'adjustment'
export type DeltaResult = { delta: number } | { error: string }
```

- [ ] **Step 2: 失敗するテストを作成 `lib/inventory/__tests__/quantity.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { computeQuantity } from '../quantity'

describe('computeQuantity', () => {
  it('sums deltas', () => {
    expect(computeQuantity([10, -2, 3])).toBe(11)
  })
  it('returns 0 for empty', () => {
    expect(computeQuantity([])).toBe(0)
  })
  it('handles decimals', () => {
    expect(computeQuantity([200.5, -0.5])).toBe(200)
  })
})
```

- [ ] **Step 3: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/quantity.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 4: 実装 `lib/inventory/quantity.ts`**

```typescript
export function computeQuantity(deltas: number[]): number {
  return deltas.reduce((sum, d) => sum + d, 0)
}
```

- [ ] **Step 5: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/quantity.test.ts 2>&1 | tail -10`
Expected: 3 passed

- [ ] **Step 6: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/inventory/types.ts lib/inventory/quantity.ts lib/inventory/__tests__/quantity.test.ts && git commit -m "feat(b2): inventory types + computeQuantity"
```

---

### Task 2: `buildMovementDelta`

**Files:**
- Create: `lib/inventory/movement.ts`
- Test: `lib/inventory/__tests__/movement.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/inventory/__tests__/movement.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildMovementDelta } from '../movement'

describe('buildMovementDelta - in', () => {
  it('positive value gives +delta', () => {
    expect(buildMovementDelta('in', 10, 0)).toEqual({ delta: 10 })
  })
  it('zero or negative is rejected', () => {
    expect(buildMovementDelta('in', 0, 0)).toEqual({ error: '入庫数は正の数で入力してください' })
    expect(buildMovementDelta('in', -1, 5)).toEqual({ error: '入庫数は正の数で入力してください' })
  })
})

describe('buildMovementDelta - disposal', () => {
  it('disposes within stock gives -delta', () => {
    expect(buildMovementDelta('disposal', 3, 10)).toEqual({ delta: -3 })
  })
  it('exactly current stock is allowed', () => {
    expect(buildMovementDelta('disposal', 10, 10)).toEqual({ delta: -10 })
  })
  it('exceeding stock is rejected', () => {
    expect(buildMovementDelta('disposal', 11, 10)).toEqual({ error: '在庫が足りません（現在庫 10）' })
  })
  it('zero or negative is rejected', () => {
    expect(buildMovementDelta('disposal', 0, 10)).toEqual({ error: '廃棄数は正の数で入力してください' })
  })
})

describe('buildMovementDelta - adjustment', () => {
  it('actual above current gives positive delta', () => {
    expect(buildMovementDelta('adjustment', 8, 5)).toEqual({ delta: 3 })
  })
  it('actual below current gives negative delta', () => {
    expect(buildMovementDelta('adjustment', 2, 5)).toEqual({ delta: -3 })
  })
  it('actual equals current gives zero', () => {
    expect(buildMovementDelta('adjustment', 5, 5)).toEqual({ delta: 0 })
  })
  it('negative actual is rejected', () => {
    expect(buildMovementDelta('adjustment', -1, 5)).toEqual({ error: '実数は0以上で入力してください' })
  })
})

describe('buildMovementDelta - invalid', () => {
  it('unknown type is rejected', () => {
    expect(buildMovementDelta('xxx' as never, 1, 0)).toEqual({ error: '不明な操作です' })
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/movement.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/inventory/movement.ts`**

```typescript
import type { MovementType, DeltaResult } from './types'

export function buildMovementDelta(type: MovementType, value: number, currentQty: number): DeltaResult {
  if (type === 'in') {
    if (!(value > 0)) return { error: '入庫数は正の数で入力してください' }
    return { delta: value }
  }
  if (type === 'disposal') {
    if (!(value > 0)) return { error: '廃棄数は正の数で入力してください' }
    if (value > currentQty) return { error: `在庫が足りません（現在庫 ${currentQty}）` }
    return { delta: -value }
  }
  if (type === 'adjustment') {
    if (value < 0) return { error: '実数は0以上で入力してください' }
    return { delta: value - currentQty }
  }
  return { error: '不明な操作です' }
}
```

- [ ] **Step 4: テスト成功 ＋ 全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/movement.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: movement 12 passed、全体 pass（143 + 15 = 158）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/inventory/movement.ts lib/inventory/__tests__/movement.test.ts && git commit -m "feat(b2): buildMovementDelta with validation"
```

---

### Task 3: SQL マイグレーション

**Files:** Create `supabase/migrations/013_inventory.sql`

- [ ] **Step 1: 作成**

```sql
-- supabase/migrations/013_inventory.sql
CREATE TABLE stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type           text NOT NULL,
  quantity_delta numeric NOT NULL,
  note           text,
  occurred_at    date NOT NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_stock_movements_item ON stock_movements (item_id);
CREATE INDEX idx_stock_movements_date ON stock_movements (occurred_at);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE items ADD COLUMN IF NOT EXISTS current_quantity numeric NOT NULL DEFAULT 0;
```

- [ ] **Step 2: コミット**（Supabase 実行は Task 7）

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/013_inventory.sql && git commit -m "feat(b2): stock_movements + items.current_quantity migration"
```

---

### Task 4: 在庫 API（記録・履歴）

**Files:**
- Create: `app/api/admin/inventory/movements/route.ts`

- [ ] **Step 1: 作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildMovementDelta } from '@/lib/inventory/movement'
import type { MovementType } from '@/lib/inventory/types'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const itemId = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId が必要です' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('stock_movements').select('*')
    .eq('item_id', itemId)
    .order('occurred_at', { ascending: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movements: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { itemId?: string; type?: string; value?: number; occurredAt?: string; note?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { itemId, type, value, occurredAt, note } = body
  if (!itemId || !type || typeof value !== 'number' || !occurredAt)
    return NextResponse.json({ error: 'itemId / type / value / occurredAt が必要です' }, { status: 400 })

  const { data: item } = await supabaseAdmin
    .from('items').select('id, track_inventory, current_quantity').eq('id', itemId).maybeSingle()
  if (!item) return NextResponse.json({ error: '品目が見つかりません' }, { status: 404 })
  if (item.track_inventory !== true) return NextResponse.json({ error: '在庫管理対象外の品目です' }, { status: 400 })

  const currentQty = Number(item.current_quantity)
  const result = buildMovementDelta(type as MovementType, value, currentQty)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data: movement, error: insErr } = await supabaseAdmin
    .from('stock_movements')
    .insert({ item_id: itemId, type, quantity_delta: result.delta, note: note ?? null, occurred_at: occurredAt })
    .select().single()
  if (insErr || !movement) return NextResponse.json({ error: insErr?.message ?? '記録に失敗しました' }, { status: 500 })

  const newQty = currentQty + result.delta
  const { error: updErr } = await supabaseAdmin.from('items').update({ current_quantity: newQty }).eq('id', itemId)
  if (updErr) {
    await supabaseAdmin.from('stock_movements').delete().eq('id', movement.id)  // rollback
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  return NextResponse.json({ currentQuantity: newQty, movement })
}
```

- [ ] **Step 2: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add app/api/admin/inventory/movements/route.ts && git commit -m "feat(b2): inventory movements API (record + history)"
```

---

### Task 5: 再計算 API

**Files:**
- Create: `app/api/admin/inventory/recompute/route.ts`

- [ ] **Step 1: 作成**

```typescript
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { computeQuantity } from '@/lib/inventory/quantity'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items } = await supabaseAdmin.from('items').select('id').eq('track_inventory', true)
  const { data: moves } = await supabaseAdmin.from('stock_movements').select('item_id, quantity_delta')

  const byItem = new Map<string, number[]>()
  for (const m of moves ?? []) {
    const arr = byItem.get(m.item_id) ?? []
    arr.push(Number(m.quantity_delta))
    byItem.set(m.item_id, arr)
  }

  for (const it of items ?? []) {
    const qty = computeQuantity(byItem.get(it.id) ?? [])
    await supabaseAdmin.from('items').update({ current_quantity: qty }).eq('id', it.id)
  }
  return NextResponse.json({ ok: true, recalculated: (items ?? []).length })
}
```

- [ ] **Step 2: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add app/api/admin/inventory/recompute/route.ts && git commit -m "feat(b2): inventory recompute API"
```

---

### Task 6: UI（在庫管理）＋ ナビ

**Files:**
- Create: `components/admin/inventory/InventoryManager.tsx`
- Create: `app/admin/(dashboard)/inventory/page.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: `components/admin/inventory/InventoryManager.tsx` を作成**

```tsx
'use client'
import { useState } from 'react'

interface Item { id: string; name: string; category: string; unit: string; current_quantity: number }
interface Movement { id: string; type: string; quantity_delta: number; note: string | null; occurred_at: string }

const TYPE_LABEL: Record<string, string> = { in: '入庫', disposal: '廃棄', adjustment: '棚卸調整' }
const CAT_LABEL: Record<string, string> = { ingredient: '食材', dish: '料理', goods: '物販', drink: 'ドリンク', supply: '消耗品' }

function Row({ item }: { item: Item }) {
  const [qty, setQty] = useState(item.current_quantity)
  const [type, setType] = useState<'in' | 'disposal' | 'adjustment'>('in')
  const [value, setValue] = useState('')
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<Movement[] | null>(null)
  const [busy, setBusy] = useState(false)

  const record = async () => {
    setError(null); setBusy(true)
    try {
      const res = await fetch('/api/admin/inventory/movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, type, value: Number(value), occurredAt, note: note || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '記録に失敗しました'); return }
      setQty(json.currentQuantity)
      setValue(''); setNote('')
      if (open) loadHistory()
    } finally { setBusy(false) }
  }

  const loadHistory = async () => {
    const res = await fetch(`/api/admin/inventory/movements?itemId=${item.id}`)
    const json = await res.json()
    if (res.ok) setHistory(json.movements)
  }
  const toggle = () => { const n = !open; setOpen(n); if (n && history === null) loadHistory() }

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="font-medium text-warm-700">{item.name}</span>
          <span className="ml-2 text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">{CAT_LABEL[item.category] ?? item.category}</span>
        </div>
        <div className={`font-bold ${qty <= 0 ? 'text-red-500' : 'text-warm-700'}`}>現在庫 {qty} {item.unit}</div>
      </div>

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 items-center">
        <select value={type} onChange={e => setType(e.target.value as 'in' | 'disposal' | 'adjustment')}
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm">
          <option value="in">入庫</option>
          <option value="disposal">廃棄</option>
          <option value="adjustment">棚卸調整(実数)</option>
        </select>
        <input type="number" step="any" value={value} onChange={e => setValue(e.target.value)}
          placeholder={type === 'adjustment' ? '実数' : '数量'}
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm text-right" />
        <input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)}
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm" />
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="メモ"
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm" />
        <button onClick={record} disabled={busy || !value}
          className="bg-warm-500 hover:bg-warm-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-40">記録</button>
      </div>

      <button onClick={toggle} className="mt-2 text-warm-500 text-xs hover:text-warm-700">{open ? '▼ 履歴を隠す' : '▶ 動き履歴'}</button>
      {open && history && (
        <table className="w-full text-xs mt-2">
          <tbody>
            {history.map(m => (
              <tr key={m.id} className="border-b border-warm-50">
                <td className="py-1 text-warm-500">{m.occurred_at}</td>
                <td className="text-warm-600">{TYPE_LABEL[m.type] ?? m.type}</td>
                <td className={`text-right ${m.quantity_delta < 0 ? 'text-red-500' : 'text-green-600'}`}>{m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}</td>
                <td className="text-warm-400 pl-2">{m.note ?? ''}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={4} className="text-warm-300 py-2">履歴なし</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function InventoryManager({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-warm-400 text-sm">在庫管理対象の品目がありません。「商品・メニュー管理」で品目の「在庫管理」をオンにしてください。</p>
  }
  return <div className="space-y-2">{items.map(it => <Row key={it.id} item={it} />)}</div>
}
```

- [ ] **Step 2: `app/admin/(dashboard)/inventory/page.tsx` を作成**

```tsx
import { supabaseAdmin } from '@/lib/supabase'
import InventoryManager from '@/components/admin/inventory/InventoryManager'

export const revalidate = 0

export default async function InventoryPage() {
  const { data: items } = await supabaseAdmin
    .from('items')
    .select('id, name, category, unit, current_quantity')
    .eq('track_inventory', true).eq('is_active', true)
    .order('category').order('name')

  const normalized = (items ?? []).map(i => ({
    id: i.id, name: i.name, category: i.category, unit: i.unit,
    current_quantity: Number(i.current_quantity),
  }))

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">在庫管理</h1>
      <p className="text-warm-400 text-sm mb-4">在庫管理対象の品目の現在庫・入出庫・廃棄・棚卸調整を管理します。</p>
      <InventoryManager items={normalized} />
    </div>
  )
}
```

- [ ] **Step 3: `app/admin/(dashboard)/layout.tsx` のナビに追加**

商品・メニュー管理（`🍖`）の後に追加:
```typescript
{ href: '/admin/inventory', label: '📦 在庫管理' },
```

- [ ] **Step 4: 型チェック・ビルド・全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 型エラーなし・ビルド成功（`/admin/inventory` がルート一覧に出る）・全テスト pass

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/admin/inventory "app/admin/(dashboard)/inventory/page.tsx" "app/admin/(dashboard)/layout.tsx" && git commit -m "feat(b2): inventory management UI + nav"
```

---

### Task 7: SQL 実行 ＋ デプロイ

**Files:** なし

- [ ] **Step 1: SQL をクリップボードにコピー（UTF-16LE）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && node -e "const fs=require('fs');const{spawnSync}=require('child_process');const t=fs.readFileSync('supabase/migrations/013_inventory.sql','utf8').replace(/^﻿/,'');spawnSync('clip',{input:Buffer.from(t,'utf16le')});console.log('copied')"
```

- [ ] **Step 2: Supabase SQL エディタで実行**

翻訳オフの Chrome で `https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new` を開き、貼り付けて Run。Expected: 「Success. No rows returned」

- [ ] **Step 3: テーブル/カラム確認**

```bash
node -e "
const https=require('https');
const k='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/stock_movements?limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('stock_movements:',r.statusCode===200?'OK':'ERR '+r.statusCode));
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/items?select=id,current_quantity&limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('items.current_quantity:',r.statusCode===200?'OK':'ERR '+r.statusCode));
"
```
Expected: 両方 OK

- [ ] **Step 4: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`
