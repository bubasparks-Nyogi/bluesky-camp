# サブプロジェクト B-1：商品/メニュー マスタ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 食材・料理・物販等を1つのマスタで管理し、料理にレシピ（構成食材）を登録すると原価が自動計算される品目管理機能を追加する。

**Architecture:** 純粋ロジック（原価計算・バリデーション・循環検出）を `lib/items/` に TDD で実装し、その上に Supabase テーブル2つ・admin API・管理UI（品目管理＋レシピ編集）を載せる。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin + RLS), TypeScript, Vitest, TailwindCSS warm palette。

**参照スペック:** `docs/superpowers/specs/2026-05-20-B1-item-master-design.md`

---

## 前提知識（実装者向け）
- admin API パターン: `createSupabaseServerClient()`（`@/lib/supabase-server`）で `auth.getUser()` → user 無ければ 401。`supabaseAdmin`（`@/lib/supabase`）で DML。※既存の新しめのルートは `getUser()` を使用（`getSession()` ではなく）。
- admin ページは `app/admin/(dashboard)/` 配下（認証継承）。ナビ配列は `app/admin/(dashboard)/layout.tsx`。
- 既存の管理コンポーネント例: `components/admin/accounting/AccountManager.tsx`。
- 金額は整数（円）。数量は小数可（numeric）。
- シェル: Bash（Git Bash）。パス `C:/Users/biscu/Downloads/bluesky-camp`。既存テスト総数 126。

---

### Task 1: 型 + `computeDishCost`

**Files:**
- Create: `lib/items/types.ts`
- Create: `lib/items/cost.ts`
- Test: `lib/items/__tests__/cost.test.ts`

- [ ] **Step 1: `lib/items/types.ts` を作成**

```typescript
export type ItemCategory = 'ingredient' | 'dish' | 'goods' | 'drink' | 'supply'

export interface ItemInput {
  name: string
  category: ItemCategory
  unit: string
  salePrice: number | null
  costPrice: number | null
  isSellable: boolean
  trackInventory: boolean
}

export interface ComponentCostLine {
  costPrice: number | null
  quantity: number
}

export interface ComponentEdge {
  parentId: string
  componentId: string
}
```

- [ ] **Step 2: 失敗するテストを作成 `lib/items/__tests__/cost.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { computeDishCost } from '../cost'

describe('computeDishCost', () => {
  it('sums costPrice * quantity rounded to integer', () => {
    expect(computeDishCost([
      { costPrice: 1200, quantity: 0.2 },
      { costPrice: 300, quantity: 1 },
    ])).toEqual({ cost: 540, hasMissingCost: false })
  })
  it('flags missing cost (null) and treats it as 0', () => {
    expect(computeDishCost([
      { costPrice: null, quantity: 2 },
      { costPrice: 500, quantity: 1 },
    ])).toEqual({ cost: 500, hasMissingCost: true })
  })
  it('returns zero for empty', () => {
    expect(computeDishCost([])).toEqual({ cost: 0, hasMissingCost: false })
  })
  it('rounds fractional yen', () => {
    expect(computeDishCost([{ costPrice: 333, quantity: 0.5 }]).cost).toBe(167) // 166.5 → 167
  })
})
```

- [ ] **Step 3: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/items/__tests__/cost.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 4: 実装 `lib/items/cost.ts`**

```typescript
import type { ComponentCostLine } from './types'

export function computeDishCost(lines: ComponentCostLine[]): { cost: number; hasMissingCost: boolean } {
  let total = 0
  let hasMissingCost = false
  for (const l of lines) {
    if (l.costPrice == null) hasMissingCost = true
    total += (l.costPrice ?? 0) * l.quantity
  }
  return { cost: Math.round(total), hasMissingCost }
}
```

- [ ] **Step 5: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/items/__tests__/cost.test.ts 2>&1 | tail -10`
Expected: 4 passed

- [ ] **Step 6: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/items/types.ts lib/items/cost.ts lib/items/__tests__/cost.test.ts && git commit -m "feat(b1): item types + computeDishCost"
```

---

### Task 2: `validateItem` + `validateComponent`

**Files:**
- Create: `lib/items/validate.ts`
- Test: `lib/items/__tests__/validate.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/items/__tests__/validate.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { validateItem, validateComponent } from '../validate'
import type { ItemInput } from '../types'

const base: ItemInput = {
  name: '国産牛肉', category: 'ingredient', unit: 'g',
  salePrice: null, costPrice: 1200, isSellable: false, trackInventory: true,
}

describe('validateItem', () => {
  it('returns null for a valid item', () => {
    expect(validateItem(base)).toBeNull()
  })
  it('rejects empty name', () => {
    expect(validateItem({ ...base, name: '  ' })).toBe('名称を入力してください')
  })
  it('rejects invalid category', () => {
    expect(validateItem({ ...base, category: 'xxx' as never })).toBe('カテゴリが不正です')
  })
  it('rejects negative or non-integer price', () => {
    expect(validateItem({ ...base, costPrice: -1 })).toBe('金額は0以上の整数で入力してください')
    expect(validateItem({ ...base, costPrice: 1.5 })).toBe('金額は0以上の整数で入力してください')
  })
  it('requires salePrice when sellable', () => {
    expect(validateItem({ ...base, isSellable: true, salePrice: null })).toBe('販売する品目は販売価格を入力してください')
  })
  it('accepts sellable item with salePrice', () => {
    expect(validateItem({ ...base, category: 'dish', isSellable: true, salePrice: 3000 })).toBeNull()
  })
})

describe('validateComponent', () => {
  it('returns null for valid component', () => {
    expect(validateComponent('a', 'b', 200)).toBeNull()
  })
  it('rejects self reference', () => {
    expect(validateComponent('a', 'a', 1)).toBe('自分自身を構成食材にできません')
  })
  it('rejects non-positive quantity', () => {
    expect(validateComponent('a', 'b', 0)).toBe('数量は正の数で入力してください')
    expect(validateComponent('a', 'b', -2)).toBe('数量は正の数で入力してください')
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/items/__tests__/validate.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/items/validate.ts`**

```typescript
import type { ItemInput, ItemCategory } from './types'

const CATEGORIES: ItemCategory[] = ['ingredient', 'dish', 'goods', 'drink', 'supply']

function isValidMoney(v: number | null): boolean {
  return v == null || (Number.isInteger(v) && v >= 0)
}

export function validateItem(input: ItemInput): string | null {
  if (!input.name || input.name.trim().length === 0) return '名称を入力してください'
  if (!CATEGORIES.includes(input.category)) return 'カテゴリが不正です'
  if (!isValidMoney(input.salePrice) || !isValidMoney(input.costPrice))
    return '金額は0以上の整数で入力してください'
  if (input.isSellable && input.salePrice == null)
    return '販売する品目は販売価格を入力してください'
  return null
}

export function validateComponent(parentId: string, componentId: string, quantity: number): string | null {
  if (parentId === componentId) return '自分自身を構成食材にできません'
  if (!(typeof quantity === 'number' && quantity > 0)) return '数量は正の数で入力してください'
  return null
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/items/__tests__/validate.test.ts 2>&1 | tail -10`
Expected: 9 passed

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/items/validate.ts lib/items/__tests__/validate.test.ts && git commit -m "feat(b1): validateItem + validateComponent"
```

---

### Task 3: `detectRecipeCycle`

**Files:**
- Create: `lib/items/cycle.ts`
- Test: `lib/items/__tests__/cycle.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/items/__tests__/cycle.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { detectRecipeCycle } from '../cycle'
import type { ComponentEdge } from '../types'

describe('detectRecipeCycle', () => {
  it('returns false when adding a non-cyclic edge', () => {
    const edges: ComponentEdge[] = [{ parentId: 'A', componentId: 'B' }]
    // add A->C : no cycle
    expect(detectRecipeCycle('A', 'C', edges)).toBe(false)
  })
  it('detects a direct back-edge (B already contains A)', () => {
    const edges: ComponentEdge[] = [{ parentId: 'B', componentId: 'A' }]
    // adding A->B would cycle (A->B->A)
    expect(detectRecipeCycle('A', 'B', edges)).toBe(true)
  })
  it('detects a multi-level cycle (C->A exists, adding A->? leads back)', () => {
    // existing: A->B, B->C. adding C->A would cycle
    const edges: ComponentEdge[] = [
      { parentId: 'A', componentId: 'B' },
      { parentId: 'B', componentId: 'C' },
    ]
    expect(detectRecipeCycle('C', 'A', edges)).toBe(true)
  })
  it('returns false for unrelated edges', () => {
    const edges: ComponentEdge[] = [
      { parentId: 'A', componentId: 'B' },
      { parentId: 'C', componentId: 'D' },
    ]
    expect(detectRecipeCycle('A', 'D', edges)).toBe(false)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/items/__tests__/cycle.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/items/cycle.ts`**

```typescript
import type { ComponentEdge } from './types'

/**
 * parent -> component の有向辺を追加したとき循環するかを判定する。
 * component を起点に既存の辺を辿り、parent に到達できれば循環（true）。
 */
export function detectRecipeCycle(parentId: string, componentId: string, edges: ComponentEdge[]): boolean {
  // 隣接リスト: parent -> [components]
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const arr = adj.get(e.parentId) ?? []
    arr.push(e.componentId)
    adj.set(e.parentId, arr)
  }
  // component から parent に到達できるか DFS
  const visited = new Set<string>()
  const stack = [componentId]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node === parentId) return true
    if (visited.has(node)) continue
    visited.add(node)
    for (const next of adj.get(node) ?? []) stack.push(next)
  }
  return false
}
```

- [ ] **Step 4: テスト成功 ＋ 全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/items/__tests__/cycle.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: cycle 4 passed、全体 pass（126 + 17 = 143）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/items/cycle.ts lib/items/__tests__/cycle.test.ts && git commit -m "feat(b1): detectRecipeCycle"
```

---

### Task 4: SQL マイグレーション

**Files:** Create `supabase/migrations/012_items.sql`

- [ ] **Step 1: 作成**

```sql
-- supabase/migrations/012_items.sql
CREATE TABLE items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL,
  unit            text NOT NULL DEFAULT '個',
  sale_price      integer,
  cost_price      integer,
  is_sellable     boolean NOT NULL DEFAULT true,
  track_inventory boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_items_category ON items (category);
CREATE INDEX idx_items_active   ON items (is_active);

CREATE TABLE item_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id    uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  component_item_id uuid NOT NULL REFERENCES items(id),
  quantity          numeric NOT NULL CHECK (quantity > 0),
  UNIQUE (parent_item_id, component_item_id)
);
CREATE INDEX idx_item_components_parent ON item_components (parent_item_id);

ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_components ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: コミット**（Supabase 実行は Task 8）

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/012_items.sql && git commit -m "feat(b1): items + item_components SQL migration"
```

---

### Task 5: 品目 API

**Files:**
- Create: `app/api/admin/items/route.ts`
- Create: `app/api/admin/items/[id]/route.ts`

- [ ] **Step 1: `app/api/admin/items/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateItem } from '@/lib/items/validate'
import { computeDishCost } from '@/lib/items/cost'
import type { ItemInput } from '@/lib/items/types'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items, error } = await supabaseAdmin
    .from('items').select('*').order('sort_order').order('category')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: comps } = await supabaseAdmin.from('item_components').select('*')
  const costById = new Map((items ?? []).map(i => [i.id, i.cost_price as number | null]))

  // 料理ごとの自動原価
  const dishCost: Record<string, { cost: number; hasMissingCost: boolean }> = {}
  for (const it of items ?? []) {
    if (it.category !== 'dish') continue
    const lines = (comps ?? [])
      .filter(c => c.parent_item_id === it.id)
      .map(c => ({ costPrice: costById.get(c.component_item_id) ?? null, quantity: Number(c.quantity) }))
    dishCost[it.id] = computeDishCost(lines)
  }

  return NextResponse.json({ items: items ?? [], dishCost })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const input: ItemInput = {
    name: String(body.name ?? ''),
    category: body.category as ItemInput['category'],
    unit: String(body.unit ?? '個'),
    salePrice: body.salePrice == null ? null : Number(body.salePrice),
    costPrice: body.costPrice == null ? null : Number(body.costPrice),
    isSellable: Boolean(body.isSellable),
    trackInventory: Boolean(body.trackInventory),
  }
  const err = validateItem(input)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('items').insert({
    name: input.name.trim(), category: input.category, unit: input.unit,
    sale_price: input.salePrice, cost_price: input.costPrice,
    is_sellable: input.isSellable, track_inventory: input.trackInventory,
    sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
```

- [ ] **Step 2: `app/api/admin/items/[id]/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateItem } from '@/lib/items/validate'
import type { ItemInput } from '@/lib/items/types'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const input: ItemInput = {
    name: String(body.name ?? ''),
    category: body.category as ItemInput['category'],
    unit: String(body.unit ?? '個'),
    salePrice: body.salePrice == null ? null : Number(body.salePrice),
    costPrice: body.costPrice == null ? null : Number(body.costPrice),
    isSellable: Boolean(body.isSellable),
    trackInventory: Boolean(body.trackInventory),
  }
  const err = validateItem(input)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const update: Record<string, unknown> = {
    name: input.name.trim(), category: input.category, unit: input.unit,
    sale_price: input.salePrice, cost_price: input.costPrice,
    is_sellable: input.isSellable, track_inventory: input.trackInventory,
  }
  if (body.isActive !== undefined) update.is_active = Boolean(body.isActive)
  if (body.sortOrder !== undefined && Number.isInteger(body.sortOrder)) update.sort_order = body.sortOrder

  const { error } = await supabaseAdmin.from('items').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 他の料理の構成食材として使われていれば削除不可
  const { data: usedAs } = await supabaseAdmin
    .from('item_components').select('id').eq('component_item_id', params.id).limit(1)
  if ((usedAs ?? []).length > 0)
    return NextResponse.json({ error: '他の料理のレシピで使用中のため削除できません（無効化してください）' }, { status: 409 })

  const { error } = await supabaseAdmin.from('items').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add app/api/admin/items/route.ts "app/api/admin/items/[id]/route.ts" && git commit -m "feat(b1): items API (CRUD with dish cost + delete guard)"
```

---

### Task 6: レシピ（構成食材）API

**Files:**
- Create: `app/api/admin/items/[id]/components/route.ts`
- Create: `app/api/admin/items/[id]/components/[componentId]/route.ts`

- [ ] **Step 1: `app/api/admin/items/[id]/components/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateComponent } from '@/lib/items/validate'
import { detectRecipeCycle } from '@/lib/items/cycle'
import type { ComponentEdge } from '@/lib/items/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('item_components')
    .select('id, parent_item_id, component_item_id, quantity, items!item_components_component_item_id_fkey(name, unit, cost_price)')
    .eq('parent_item_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ components: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { componentItemId?: string; quantity?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const componentId = body.componentItemId ?? ''
  const quantity = Number(body.quantity)
  const verr = validateComponent(params.id, componentId, quantity)
  if (verr) return NextResponse.json({ error: verr }, { status: 400 })

  // 循環チェック（既存の全エッジを取得）
  const { data: allEdges } = await supabaseAdmin
    .from('item_components').select('parent_item_id, component_item_id')
  const edges: ComponentEdge[] = (allEdges ?? []).map(e => ({
    parentId: e.parent_item_id, componentId: e.component_item_id,
  }))
  if (detectRecipeCycle(params.id, componentId, edges))
    return NextResponse.json({ error: 'この構成は循環するため追加できません' }, { status: 400 })

  const { error } = await supabaseAdmin.from('item_components').insert({
    parent_item_id: params.id, component_item_id: componentId, quantity,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 2: `app/api/admin/items/[id]/components/[componentId]/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; componentId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('item_components').delete()
    .eq('parent_item_id', params.id)
    .eq('component_item_id', params.componentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add "app/api/admin/items/[id]/components" && git commit -m "feat(b1): recipe components API (add with cycle guard / delete)"
```

注: GET の外部キー結合名 `items!item_components_component_item_id_fkey` は、実際の制約名に依存する。型チェック/動作で問題が出る場合は、結合を使わず `component_item_id` だけ返し、フロントで items 一覧と突き合わせる方式に切り替える（フォールバック）。

---

### Task 7: UI（品目管理 ＋ レシピ編集 ＋ ナビ）

**Files:**
- Create: `components/admin/items/ItemManager.tsx`
- Create: `components/admin/items/RecipeEditor.tsx`
- Create: `app/admin/(dashboard)/items/page.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: `components/admin/items/RecipeEditor.tsx` を作成**

```tsx
'use client'
import { useState } from 'react'

interface ItemLite { id: string; name: string; category: string; unit: string }
interface Comp { id: string; component_item_id: string; quantity: number; items?: { name: string; unit: string; cost_price: number | null } }
interface Props {
  dishId: string
  ingredients: ItemLite[]       // 構成食材の候補（category=ingredient/supply など）
  initialComponents: Comp[]
}

export default function RecipeEditor({ dishId, ingredients, initialComponents }: Props) {
  const [comps, setComps] = useState<Comp[]>(initialComponents)
  const [compId, setCompId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    setError(null)
    const res = await fetch(`/api/admin/items/${dishId}/components`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentItemId: compId, quantity: Number(qty) }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '追加に失敗しました'); return }
    const ing = ingredients.find(i => i.id === compId)
    setComps(c => [...c, { id: crypto.randomUUID(), component_item_id: compId, quantity: Number(qty), items: ing ? { name: ing.name, unit: ing.unit, cost_price: null } : undefined }])
    setCompId(''); setQty('')
  }

  const remove = async (componentItemId: string) => {
    const res = await fetch(`/api/admin/items/${dishId}/components/${componentItemId}`, { method: 'DELETE' })
    if (res.ok) setComps(c => c.filter(x => x.component_item_id !== componentItemId))
  }

  return (
    <div className="mt-3 border-t border-warm-100 pt-3">
      <h4 className="text-sm font-bold text-warm-600 mb-2">レシピ（構成食材）</h4>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      <div className="space-y-1 mb-2">
        {comps.map(c => (
          <div key={c.component_item_id} className="flex items-center justify-between text-sm">
            <span className="text-warm-700">{c.items?.name ?? ingredients.find(i => i.id === c.component_item_id)?.name ?? c.component_item_id}</span>
            <span className="text-warm-500">{c.quantity} {c.items?.unit ?? ''}
              <button onClick={() => remove(c.component_item_id)} className="ml-3 text-red-500 hover:text-red-700 text-xs">削除</button>
            </span>
          </div>
        ))}
        {comps.length === 0 && <p className="text-warm-300 text-xs">構成食材が未登録です</p>}
      </div>
      <div className="flex gap-2">
        <select value={compId} onChange={e => setCompId(e.target.value)}
          className="flex-1 border border-warm-200 rounded-lg px-2 py-1 text-sm">
          <option value="">食材を選択</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <input type="number" step="any" value={qty} onChange={e => setQty(e.target.value)} placeholder="数量"
          className="w-24 border border-warm-200 rounded-lg px-2 py-1 text-sm text-right" />
        <button onClick={add} disabled={!compId || !qty}
          className="bg-warm-300 hover:bg-warm-400 text-white px-3 py-1 rounded-lg text-sm disabled:opacity-40">追加</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `components/admin/items/ItemManager.tsx` を作成**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import RecipeEditor from './RecipeEditor'

interface Item {
  id: string; name: string; category: string; unit: string
  sale_price: number | null; cost_price: number | null
  is_sellable: boolean; track_inventory: boolean; is_active: boolean
}
interface Comp { id: string; component_item_id: string; quantity: number; items?: { name: string; unit: string; cost_price: number | null } }
interface Props {
  initialItems: Item[]
  dishCost: Record<string, { cost: number; hasMissingCost: boolean }>
  componentsByDish: Record<string, Comp[]>
}

const CATS = [
  { value: 'ingredient', label: '食材' }, { value: 'dish', label: '料理' },
  { value: 'goods', label: '物販' }, { value: 'drink', label: 'ドリンク' }, { value: 'supply', label: '消耗品' },
]
const catLabel = (v: string) => CATS.find(c => c.value === v)?.label ?? v

export default function ItemManager({ initialItems, dishCost, componentsByDish }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [form, setForm] = useState({ name: '', category: 'ingredient', unit: '個', salePrice: '', costPrice: '', isSellable: false, trackInventory: true })
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const ingredients = items.filter(i => i.is_active).map(i => ({ id: i.id, name: i.name, category: i.category, unit: i.unit }))

  const add = async () => {
    setError(null)
    const res = await fetch('/api/admin/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, category: form.category, unit: form.unit,
        salePrice: form.salePrice === '' ? null : Number(form.salePrice),
        costPrice: form.costPrice === '' ? null : Number(form.costPrice),
        isSellable: form.isSellable, trackInventory: form.trackInventory,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '追加に失敗しました'); return }
    setItems(i => [...i, json.item])
    setForm({ name: '', category: 'ingredient', unit: '個', salePrice: '', costPrice: '', isSellable: false, trackInventory: true })
    router.refresh()
  }

  const toggleActive = async (it: Item) => {
    const res = await fetch(`/api/admin/items/${it.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: it.name, category: it.category, unit: it.unit,
        salePrice: it.sale_price, costPrice: it.cost_price,
        isSellable: it.is_sellable, trackInventory: it.track_inventory,
        isActive: !it.is_active,
      }),
    })
    if (res.ok) setItems(list => list.map(x => x.id === it.id ? { ...x, is_active: !it.is_active } : x))
  }

  const remove = async (it: Item) => {
    if (!confirm(`「${it.name}」を削除しますか？`)) return
    const res = await fetch(`/api/admin/items/${it.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (res.ok) setItems(list => list.filter(x => x.id !== it.id))
    else alert(json.error ?? '削除できませんでした')
  }

  const shown = filter === 'all' ? items : items.filter(i => i.category === filter)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-warm-100 rounded-xl p-4">
        <h2 className="font-bold text-warm-700 mb-3">品目を追加</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <div className="grid md:grid-cols-3 gap-2">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="名称"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm">
            {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="単位（個/g/食）"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm" />
          <input type="number" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} placeholder="販売価格"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-right" />
          <input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} placeholder="原価"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-right" />
        </div>
        <div className="flex gap-4 mt-2 text-sm text-warm-600">
          <label className="flex items-center gap-1"><input type="checkbox" checked={form.isSellable} onChange={e => setForm({ ...form, isSellable: e.target.checked })} /> 販売可</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={form.trackInventory} onChange={e => setForm({ ...form, trackInventory: e.target.checked })} /> 在庫管理</label>
        </div>
        <button onClick={add} className="mt-3 bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm">追加</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1 rounded-full border ${filter==='all'?'bg-warm-500 text-white border-warm-500':'border-warm-200 text-warm-500'}`}>すべて</button>
        {CATS.map(c => <button key={c.value} onClick={() => setFilter(c.value)} className={`text-xs px-3 py-1 rounded-full border ${filter===c.value?'bg-warm-500 text-white border-warm-500':'border-warm-200 text-warm-500'}`}>{c.label}</button>)}
      </div>

      <div className="space-y-2">
        {shown.map(it => (
          <div key={it.id} className={`border rounded-xl p-4 ${it.is_active ? 'bg-white border-warm-100' : 'bg-warm-50 border-warm-200 opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-warm-700">{it.name}</span>
                  <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">{catLabel(it.category)}</span>
                  {it.is_sellable && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">販売可</span>}
                  {it.track_inventory && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">在庫</span>}
                </div>
                <p className="text-warm-500 text-sm mt-1">
                  単位 {it.unit}
                  {it.sale_price != null && ` ・ 販売 ¥${it.sale_price.toLocaleString()}`}
                  {it.cost_price != null && ` ・ 原価 ¥${it.cost_price.toLocaleString()}`}
                  {it.category === 'dish' && dishCost[it.id] && ` ・ 料理原価 ¥${dishCost[it.id].cost.toLocaleString()}${dishCost[it.id].hasMissingCost ? '（原価未設定の食材あり）' : ''}`}
                </p>
                {it.category === 'dish' && (
                  <RecipeEditor dishId={it.id} ingredients={ingredients.filter(i => i.id !== it.id)} initialComponents={componentsByDish[it.id] ?? []} />
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => toggleActive(it)} className={`text-xs px-3 py-1 rounded-lg ${it.is_active ? 'bg-warm-100 text-warm-600 hover:bg-warm-200' : 'bg-green-500 text-white hover:bg-green-600'}`}>{it.is_active ? '無効化' : '有効化'}</button>
                <button onClick={() => remove(it)} className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">削除</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `app/admin/(dashboard)/items/page.tsx` を作成**

```tsx
import { supabaseAdmin } from '@/lib/supabase'
import ItemManager from '@/components/admin/items/ItemManager'
import { computeDishCost } from '@/lib/items/cost'

export const revalidate = 0

export default async function ItemsPage() {
  const { data: items } = await supabaseAdmin.from('items').select('*').order('sort_order').order('category')
  const { data: comps } = await supabaseAdmin
    .from('item_components').select('id, parent_item_id, component_item_id, quantity')

  const costById = new Map((items ?? []).map(i => [i.id, i.cost_price as number | null]))
  const nameById = new Map((items ?? []).map(i => [i.id, { name: i.name as string, unit: i.unit as string }]))

  const dishCost: Record<string, { cost: number; hasMissingCost: boolean }> = {}
  const componentsByDish: Record<string, { id: string; component_item_id: string; quantity: number; items?: { name: string; unit: string; cost_price: number | null } }[]> = {}
  for (const it of items ?? []) {
    if (it.category !== 'dish') continue
    const rows = (comps ?? []).filter(c => c.parent_item_id === it.id)
    dishCost[it.id] = computeDishCost(rows.map(c => ({ costPrice: costById.get(c.component_item_id) ?? null, quantity: Number(c.quantity) })))
    componentsByDish[it.id] = rows.map(c => {
      const meta = nameById.get(c.component_item_id)
      return { id: c.id, component_item_id: c.component_item_id, quantity: Number(c.quantity), items: meta ? { name: meta.name, unit: meta.unit, cost_price: costById.get(c.component_item_id) ?? null } : undefined }
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">商品・メニュー管理</h1>
      <ItemManager initialItems={items ?? []} dishCost={dishCost} componentsByDish={componentsByDish} />
    </div>
  )
}
```

- [ ] **Step 4: `app/admin/(dashboard)/layout.tsx` のナビに追加**

ナビ配列の会計（`🧮 会計`）の前後どこかに追加:
```typescript
{ href: '/admin/items', label: '🍖 商品・メニュー管理' },
```

- [ ] **Step 5: 型チェック・ビルド・全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 型エラーなし・ビルド成功（`/admin/items` がルート一覧に出る）・全テスト pass

- [ ] **Step 6: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/admin/items "app/admin/(dashboard)/items/page.tsx" "app/admin/(dashboard)/layout.tsx" && git commit -m "feat(b1): item management UI with recipe editor + nav"
```

---

### Task 8: SQL 実行 ＋ デプロイ

**Files:** なし

- [ ] **Step 1: SQL をクリップボードにコピー（UTF-16LE・翻訳オフ）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && node -e "const fs=require('fs');const{spawnSync}=require('child_process');const t=fs.readFileSync('supabase/migrations/012_items.sql','utf8').replace(/^﻿/,'');spawnSync('clip',{input:Buffer.from(t,'utf16le')});console.log('copied')"
```

- [ ] **Step 2: Supabase SQL エディタで実行**

翻訳オフの Chrome で `https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new` を開き、貼り付けて Run。Expected: 「Success. No rows returned」

- [ ] **Step 3: テーブル確認**

```bash
node -e "
const https=require('https');
const k='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/items?limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('items:',r.statusCode===200?'OK':'ERR '+r.statusCode));
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/item_components?limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('item_components:',r.statusCode===200?'OK':'ERR '+r.statusCode));
"
```
Expected: 両方 OK

- [ ] **Step 4: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`
