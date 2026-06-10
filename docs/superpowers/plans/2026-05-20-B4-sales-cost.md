# サブプロジェクト B-4：売上原価の会計連携 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 販売明細(B-3)から売上仕訳と在庫消費を即時自動生成し、年末の期末棚卸（三分法）まで完結させる。

**Architecture:** 純粋ロジック（消費展開・売上仕訳・棚卸モデル）を `lib/inventory/` ・ `lib/accounting/` に TDD で固め、サーバ側 helper（`serverConsume.ts` / `serverSalePosting.ts`）で B-3 既存 API に統合。期末棚卸は新規 API＋管理画面。仕訳は既存の `journal_entries.source/source_id` 規約で追跡。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin + RLS), TypeScript, Vitest, TailwindCSS warm palette。

**参照スペック:** `docs/superpowers/specs/2026-05-20-B4-sales-cost-design.md`

---

## 前提知識（実装者向け）
- B-1: `items` テーブル（id, name, category, unit, sale_price, cost_price, is_sellable, track_inventory, current_quantity, is_active）。`item_components` テーブル（parent_item_id, component_item_id, quantity）。
- B-2: `stock_movements`（item_id, type: 'in'|'disposal'|'adjustment'|'consume', quantity_delta, note, occurred_at）。`items.current_quantity` キャッシュ。
- B-3: `sale_lines`（id, reservation_id, item_id, item_name, unit_price, quantity, occurred_at, note）。`/api/admin/reservations/[id]/sale-lines/route.ts`（GET/POST）と `[lineId]/route.ts`（DELETE）が既存。
- 会計 A: `journal_entries`（id, entry_date, description, source, source_id）+ `journal_lines`（journal_entry_id, account_id, side: 'debit'|'credit', amount, line_order）。`accounts`（id, code, name, category, normal_balance）。`validateEntry(entry): string | null` 純粋関数（`lib/accounting/validateEntry.ts`）。`JournalEntryInput = { entryDate, description, lines: { accountId, side, amount }[] }`。
- 会計 A の `serverPosting.ts` に類似パターン: build account map、validate、insert header + lines、rollback。
- admin API: `createSupabaseServerClient()` で `auth.getUser()` → user 無ければ 401。`supabaseAdmin` で DML。
- シェル: Bash（Git Bash）。パス `C:/Users/biscu/Downloads/bluesky-camp`。既存テスト総数 161。

---

### Task 1: `expandConsumption` 純粋ロジック

**Files:**
- Create: `lib/inventory/consume.ts`
- Test: `lib/inventory/__tests__/consume.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/inventory/__tests__/consume.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { expandConsumption } from '../consume'
import type { ItemLite, ComponentLine } from '../consume'

const tracked = (id: string, category: ItemLite['category']): ItemLite => ({ id, category, trackInventory: true })
const untracked = (id: string, category: ItemLite['category']): ItemLite => ({ id, category, trackInventory: false })

describe('expandConsumption', () => {
  it('dish: expands recipe components by sale quantity', () => {
    const meat = tracked('meat', 'ingredient')
    const charcoal = tracked('charcoal', 'supply')
    const dish = tracked('bbq', 'dish')
    const lookup = new Map([['meat', meat], ['charcoal', charcoal], ['bbq', dish]])
    const components: ComponentLine[] = [
      { componentItemId: 'meat',     quantity: 200 },
      { componentItemId: 'charcoal', quantity: 1 },
    ]
    const out = expandConsumption({ saleQuantity: 2, item: dish, components, itemLookup: lookup })
    expect(out).toEqual([
      { itemId: 'meat',     quantity: 400 },
      { itemId: 'charcoal', quantity: 2 },
    ])
  })

  it('non-dish tracked item: consumes itself', () => {
    const beer = tracked('beer', 'drink')
    const lookup = new Map([['beer', beer]])
    expect(expandConsumption({ saleQuantity: 3, item: beer, components: [], itemLookup: lookup }))
      .toEqual([{ itemId: 'beer', quantity: 3 }])
  })

  it('non-dish untracked item: skipped', () => {
    const water = untracked('water', 'drink')
    const lookup = new Map([['water', water]])
    expect(expandConsumption({ saleQuantity: 2, item: water, components: [], itemLookup: lookup }))
      .toEqual([])
  })

  it('dish with one untracked component: skips that component only', () => {
    const meat = tracked('meat', 'ingredient')
    const seasoning = untracked('seasoning', 'ingredient')
    const dish = tracked('curry', 'dish')
    const lookup = new Map([['meat', meat], ['seasoning', seasoning], ['curry', dish]])
    const components: ComponentLine[] = [
      { componentItemId: 'meat',      quantity: 150 },
      { componentItemId: 'seasoning', quantity: 10 },
    ]
    const out = expandConsumption({ saleQuantity: 1, item: dish, components, itemLookup: lookup })
    expect(out).toEqual([{ itemId: 'meat', quantity: 150 }])
  })

  it('zero or negative saleQuantity: empty', () => {
    const beer = tracked('beer', 'drink')
    const lookup = new Map([['beer', beer]])
    expect(expandConsumption({ saleQuantity: 0, item: beer, components: [], itemLookup: lookup })).toEqual([])
    expect(expandConsumption({ saleQuantity: -1, item: beer, components: [], itemLookup: lookup })).toEqual([])
  })

  it('dish with zero-quantity component: skipped', () => {
    const meat = tracked('meat', 'ingredient')
    const dish = tracked('bbq', 'dish')
    const lookup = new Map([['meat', meat], ['bbq', dish]])
    const components: ComponentLine[] = [{ componentItemId: 'meat', quantity: 0 }]
    expect(expandConsumption({ saleQuantity: 2, item: dish, components, itemLookup: lookup })).toEqual([])
  })

  it('component referencing unknown item: skipped', () => {
    const dish = tracked('bbq', 'dish')
    const lookup = new Map([['bbq', dish]])
    const components: ComponentLine[] = [{ componentItemId: 'ghost', quantity: 1 }]
    expect(expandConsumption({ saleQuantity: 1, item: dish, components, itemLookup: lookup })).toEqual([])
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/consume.test.ts 2>&1 | tail -10`
Expected: FAIL（モジュール未解決）

- [ ] **Step 3: 実装 `lib/inventory/consume.ts`**

```typescript
export interface ItemLite {
  id: string
  category: 'ingredient' | 'dish' | 'goods' | 'drink' | 'supply'
  trackInventory: boolean
}

export interface ComponentLine {
  componentItemId: string
  quantity: number
}

export interface ConsumptionLine {
  itemId: string
  quantity: number
}

/**
 * 販売明細1件から、減らすべき在庫を算出する。
 * - 料理(dish): 構成食材を展開し、quantity × 販売数量 を消費（track_inventory=true のみ）
 * - その他: その品目自身（track_inventory=true のみ）
 * - 数量0以下はスキップ、対象外品目はスキップ
 */
export function expandConsumption(params: {
  saleQuantity: number
  item: ItemLite
  components: ComponentLine[]
  itemLookup: Map<string, ItemLite>
}): ConsumptionLine[] {
  const { saleQuantity, item, components, itemLookup } = params
  if (!(saleQuantity > 0)) return []

  if (item.category === 'dish') {
    const lines: ConsumptionLine[] = []
    for (const c of components) {
      if (!(c.quantity > 0)) continue
      const comp = itemLookup.get(c.componentItemId)
      if (!comp) continue
      if (comp.trackInventory !== true) continue
      lines.push({ itemId: c.componentItemId, quantity: c.quantity * saleQuantity })
    }
    return lines
  }

  if (item.trackInventory !== true) return []
  return [{ itemId: item.id, quantity: saleQuantity }]
}
```

- [ ] **Step 4: テスト成功＋全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/consume.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: consume 7 passed、全体 pass（161 + 7 = 168）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/inventory/consume.ts lib/inventory/__tests__/consume.test.ts && git commit -m "feat(b4): expandConsumption pure logic"
```

---

### Task 2: `buildSaleEntry` 純粋ロジック

**Files:**
- Create: `lib/accounting/saleEntry.ts`
- Test: `lib/accounting/__tests__/saleEntry.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/accounting/__tests__/saleEntry.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildSaleEntry } from '../saleEntry'
import { validateEntry } from '../validateEntry'

const MAP = { '103': 'id-ar', '401': 'id-sales' }

describe('buildSaleEntry', () => {
  it('builds a balanced sale entry (借売掛金/貸売上高)', () => {
    const entry = buildSaleEntry({
      saleLineId: 's1', itemName: 'BBQセット', unitPrice: 3000, quantity: 2, occurredAt: '2026-08-15',
    }, MAP)!
    expect(entry.entryDate).toBe('2026-08-15')
    expect(entry.description).toBe('売上 BBQセット')
    expect(entry.lines).toEqual([
      { accountId: 'id-ar',    side: 'debit',  amount: 6000 },
      { accountId: 'id-sales', side: 'credit', amount: 6000 },
    ])
    expect(validateEntry(entry)).toBeNull()
  })

  it('rounds fractional yen', () => {
    const entry = buildSaleEntry({
      saleLineId: 's2', itemName: 'ビール', unitPrice: 500, quantity: 1.5, occurredAt: '2026-08-15',
    }, MAP)!
    expect(entry.lines[0].amount).toBe(750)
    expect(entry.lines[1].amount).toBe(750)
    expect(validateEntry(entry)).toBeNull()
  })

  it('returns null for zero amount', () => {
    expect(buildSaleEntry({
      saleLineId: 's', itemName: 'x', unitPrice: 0, quantity: 1, occurredAt: '2026-08-15',
    }, MAP)).toBeNull()
    expect(buildSaleEntry({
      saleLineId: 's', itemName: 'x', unitPrice: 100, quantity: 0, occurredAt: '2026-08-15',
    }, MAP)).toBeNull()
  })

  it('returns null for negative amount', () => {
    expect(buildSaleEntry({
      saleLineId: 's', itemName: 'x', unitPrice: 100, quantity: -1, occurredAt: '2026-08-15',
    }, MAP)).toBeNull()
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/saleEntry.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/accounting/saleEntry.ts`**

```typescript
import type { JournalEntryInput } from './types'

export type SaleAccountMap = Record<string, string>

export interface SaleEntryInput {
  saleLineId: string
  itemName: string
  unitPrice: number
  quantity: number
  occurredAt: string
}

const CODE = { ar: '103', sales: '401' } as const

/**
 * 販売明細1件 → 売上仕訳。借方:売掛金(103), 貸方:売上高(401)。
 * amount = Math.round(unitPrice × quantity)。0以下は null。
 */
export function buildSaleEntry(input: SaleEntryInput, accountMap: SaleAccountMap): JournalEntryInput | null {
  const amount = Math.round(input.unitPrice * input.quantity)
  if (!(amount > 0)) return null
  const arId    = accountMap[CODE.ar]
  const salesId = accountMap[CODE.sales]
  if (!arId || !salesId) throw new Error(`必要な勘定科目（${CODE.ar} or ${CODE.sales}）が見つかりません`)
  return {
    entryDate: input.occurredAt,
    description: `売上 ${input.itemName}`,
    lines: [
      { accountId: arId,    side: 'debit',  amount },
      { accountId: salesId, side: 'credit', amount },
    ],
  }
}
```

- [ ] **Step 4: テスト成功＋全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/saleEntry.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 4 passed、全体 pass（168 + 4 = 172）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/saleEntry.ts lib/accounting/__tests__/saleEntry.test.ts && git commit -m "feat(b4): buildSaleEntry pure logic"
```

---

### Task 3: `buildSnapshotLines` + `buildSnapshotJournal` 純粋ロジック

**Files:**
- Create: `lib/inventory/snapshot.ts`
- Test: `lib/inventory/__tests__/snapshot.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/inventory/__tests__/snapshot.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildSnapshotLines, buildSnapshotJournal } from '../snapshot'
import { validateEntry } from '@/lib/accounting/validateEntry'

const MAP = { '105': 'id-mer', '501': 'id-pur' }

describe('buildSnapshotLines', () => {
  it('sums quantity × cost', () => {
    const r = buildSnapshotLines([
      { itemId: 'a', quantity: 10, costPrice: 200 },
      { itemId: 'b', quantity: 5,  costPrice: 300 },
    ])
    expect(r.lines.length).toBe(2)
    expect(r.lines[0].value).toBe(2000)
    expect(r.lines[1].value).toBe(1500)
    expect(r.totalValue).toBe(3500)
    expect(r.missingCostCount).toBe(0)
  })

  it('costPrice=null → value 0 and count', () => {
    const r = buildSnapshotLines([
      { itemId: 'a', quantity: 5, costPrice: null },
      { itemId: 'b', quantity: 5, costPrice: 100 },
    ])
    expect(r.lines.find(l => l.itemId === 'a')!.value).toBe(0)
    expect(r.totalValue).toBe(500)
    expect(r.missingCostCount).toBe(1)
  })

  it('quantity ≤ 0 is skipped', () => {
    const r = buildSnapshotLines([
      { itemId: 'a', quantity: 0,  costPrice: 100 },
      { itemId: 'b', quantity: -3, costPrice: 100 },
      { itemId: 'c', quantity: 1,  costPrice: 100 },
    ])
    expect(r.lines.length).toBe(1)
    expect(r.lines[0].itemId).toBe('c')
    expect(r.totalValue).toBe(100)
  })

  it('rounds fractional yen', () => {
    const r = buildSnapshotLines([{ itemId: 'a', quantity: 0.5, costPrice: 333 }])
    expect(r.lines[0].value).toBe(167)
    expect(r.totalValue).toBe(167)
  })
})

describe('buildSnapshotJournal', () => {
  it('closing → 借 繰越商品 / 貸 仕入高', () => {
    const e = buildSnapshotJournal(50000, 2026, 'closing', MAP)!
    expect(e.entryDate).toBe('2026-12-31')
    expect(e.description).toBe('期末商品棚卸高 2026年度')
    expect(e.lines).toEqual([
      { accountId: 'id-mer', side: 'debit',  amount: 50000 },
      { accountId: 'id-pur', side: 'credit', amount: 50000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })

  it('opening → 借 仕入高 / 貸 繰越商品 dated Jan 1', () => {
    const e = buildSnapshotJournal(50000, 2027, 'opening', MAP)!
    expect(e.entryDate).toBe('2027-01-01')
    expect(e.description).toBe('期首商品棚卸高 2027年度')
    expect(e.lines).toEqual([
      { accountId: 'id-pur', side: 'debit',  amount: 50000 },
      { accountId: 'id-mer', side: 'credit', amount: 50000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })

  it('returns null for zero totalValue', () => {
    expect(buildSnapshotJournal(0, 2026, 'closing', MAP)).toBeNull()
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/snapshot.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/inventory/snapshot.ts`**

```typescript
import type { JournalEntryInput } from '@/lib/accounting/types'

export interface SnapshotInputItem {
  itemId: string
  quantity: number
  costPrice: number | null
}

export interface SnapshotLineResult {
  itemId: string
  quantity: number
  costPrice: number | null
  value: number
}

export interface SnapshotResult {
  lines: SnapshotLineResult[]
  totalValue: number
  missingCostCount: number
}

export function buildSnapshotLines(items: SnapshotInputItem[]): SnapshotResult {
  const lines: SnapshotLineResult[] = []
  let totalValue = 0
  let missingCostCount = 0
  for (const it of items) {
    if (!(it.quantity > 0)) continue
    let value = 0
    if (it.costPrice == null) {
      missingCostCount++
    } else {
      value = Math.round(it.quantity * it.costPrice)
    }
    lines.push({ itemId: it.itemId, quantity: it.quantity, costPrice: it.costPrice, value })
    totalValue += value
  }
  return { lines, totalValue, missingCostCount }
}

const CODE = { merchandise: '105', purchase: '501' } as const

export function buildSnapshotJournal(
  totalValue: number,
  fiscalYear: number,
  type: 'closing' | 'opening',
  accountMap: Record<string, string>,
): JournalEntryInput | null {
  if (!(totalValue > 0)) return null
  const merId = accountMap[CODE.merchandise]
  const purId = accountMap[CODE.purchase]
  if (!merId || !purId) throw new Error(`必要な勘定科目（${CODE.merchandise} or ${CODE.purchase}）が見つかりません`)

  if (type === 'closing') {
    return {
      entryDate: `${fiscalYear}-12-31`,
      description: `期末商品棚卸高 ${fiscalYear}年度`,
      lines: [
        { accountId: merId, side: 'debit',  amount: totalValue },
        { accountId: purId, side: 'credit', amount: totalValue },
      ],
    }
  }
  return {
    entryDate: `${fiscalYear}-01-01`,
    description: `期首商品棚卸高 ${fiscalYear}年度`,
    lines: [
      { accountId: purId, side: 'debit',  amount: totalValue },
      { accountId: merId, side: 'credit', amount: totalValue },
    ],
  }
}
```

- [ ] **Step 4: テスト成功＋全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/inventory/__tests__/snapshot.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 7 passed、全体 pass（172 + 7 = 179）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/inventory/snapshot.ts lib/inventory/__tests__/snapshot.test.ts && git commit -m "feat(b4): buildSnapshotLines + buildSnapshotJournal"
```

---

### Task 4: SQL マイグレーション

**Files:** Create `supabase/migrations/015_b4_consume_and_inventory.sql`

- [ ] **Step 1: 作成**

```sql
-- supabase/migrations/015_b4_consume_and_inventory.sql

-- ① stock_movements.note 検索用インデックス（type='consume' で 'sale_line:{uuid}' を保持）
CREATE INDEX IF NOT EXISTS idx_stock_movements_note ON stock_movements (note);

-- ② 繰越商品(105) 科目を追加（三分法・期末棚卸用）
INSERT INTO accounts (code, name, category, normal_balance, sort_order)
VALUES ('105', '繰越商品', 'asset', 'debit', 45)
ON CONFLICT (code) DO NOTHING;

-- ③ 期末棚卸スナップショット
CREATE TABLE inventory_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year      integer NOT NULL,
  snapshot_type    text NOT NULL,
  total_value      integer NOT NULL,
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  taken_at         timestamptz DEFAULT now(),
  UNIQUE (fiscal_year, snapshot_type)
);
CREATE INDEX idx_inventory_snapshots_year ON inventory_snapshots (fiscal_year);
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TABLE inventory_snapshot_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES inventory_snapshots(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES items(id),
  quantity    numeric NOT NULL,
  cost_price  integer,
  value       integer NOT NULL
);
CREATE INDEX idx_inventory_snapshot_lines_snapshot ON inventory_snapshot_lines (snapshot_id);
ALTER TABLE inventory_snapshot_lines ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: コミット**（Supabase 実行は Task 8）

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/015_b4_consume_and_inventory.sql && git commit -m "feat(b4): consume tracking + inventory snapshots migration"
```

---

### Task 5: サーバ helper（在庫消費・売上仕訳の保存/削除）

**Files:**
- Create: `lib/inventory/serverConsume.ts`
- Create: `lib/accounting/serverSalePosting.ts`

これらは API から呼ばれるサーバ helper。アトミックなトランザクションは Supabase クライアントの範囲外なので、ベストエフォート（失敗時にログ）で運用する。

- [ ] **Step 1: `lib/inventory/serverConsume.ts` を作成**

```typescript
import { supabaseAdmin } from '@/lib/supabase'
import { expandConsumption, type ItemLite, type ComponentLine } from './consume'

/**
 * 販売明細1件に対する在庫消費を記録する。
 * - track_inventory=true の品目について stock_movements(type='consume') を挿入
 * - items.current_quantity をその分減算
 * note には 'sale_line:{id}' を保持して、削除時に検索できるようにする。
 */
export async function postSaleConsumption(saleLine: {
  id: string
  item_id: string
  quantity: number
  occurred_at: string
}): Promise<void> {
  // 品目データを取得（target + dish なら components）
  const { data: targetItem } = await supabaseAdmin
    .from('items').select('id, category, track_inventory').eq('id', saleLine.item_id).maybeSingle()
  if (!targetItem) return

  let components: ComponentLine[] = []
  let lookup = new Map<string, ItemLite>()

  if (targetItem.category === 'dish') {
    const { data: comps } = await supabaseAdmin
      .from('item_components')
      .select('component_item_id, quantity')
      .eq('parent_item_id', targetItem.id)
    components = (comps ?? []).map(c => ({
      componentItemId: c.component_item_id,
      quantity: Number(c.quantity),
    }))
    const componentIds = components.map(c => c.componentItemId)
    if (componentIds.length > 0) {
      const { data: compItems } = await supabaseAdmin
        .from('items').select('id, category, track_inventory').in('id', componentIds)
      for (const ci of compItems ?? []) {
        lookup.set(ci.id, { id: ci.id, category: ci.category, trackInventory: ci.track_inventory })
      }
    }
  }
  lookup.set(targetItem.id, { id: targetItem.id, category: targetItem.category, trackInventory: targetItem.track_inventory })

  const consumptions = expandConsumption({
    saleQuantity: Number(saleLine.quantity),
    item: { id: targetItem.id, category: targetItem.category, trackInventory: targetItem.track_inventory },
    components,
    itemLookup: lookup,
  })
  if (consumptions.length === 0) return

  const note = `sale_line:${saleLine.id}`
  for (const c of consumptions) {
    const { error: insErr } = await supabaseAdmin.from('stock_movements').insert({
      item_id: c.itemId,
      type: 'consume',
      quantity_delta: -c.quantity,
      note,
      occurred_at: saleLine.occurred_at,
    })
    if (insErr) {
      console.error('postSaleConsumption insert failed:', insErr)
      continue
    }
    const { data: it } = await supabaseAdmin
      .from('items').select('current_quantity').eq('id', c.itemId).maybeSingle()
    const cur = Number(it?.current_quantity ?? 0)
    await supabaseAdmin.from('items').update({ current_quantity: cur - c.quantity }).eq('id', c.itemId)
  }
}

/**
 * 販売明細の削除に伴い、紐づく consume movement を reverse する。
 */
export async function deleteSaleConsumption(saleLineId: string): Promise<void> {
  const note = `sale_line:${saleLineId}`
  const { data: moves } = await supabaseAdmin
    .from('stock_movements')
    .select('id, item_id, quantity_delta').eq('note', note).eq('type', 'consume')
  for (const m of moves ?? []) {
    const { data: it } = await supabaseAdmin
      .from('items').select('current_quantity').eq('id', m.item_id).maybeSingle()
    const cur = Number(it?.current_quantity ?? 0)
    const delta = Number(m.quantity_delta)
    await supabaseAdmin.from('items').update({ current_quantity: cur - delta }).eq('id', m.item_id)
    await supabaseAdmin.from('stock_movements').delete().eq('id', m.id)
  }
}
```

- [ ] **Step 2: `lib/accounting/serverSalePosting.ts` を作成**

```typescript
import { supabaseAdmin } from '@/lib/supabase'
import { buildSaleEntry, type SaleAccountMap } from './saleEntry'
import { validateEntry } from './validateEntry'

const REQUIRED_CODES = ['103', '401']

async function buildAccountMap(): Promise<SaleAccountMap> {
  const { data } = await supabaseAdmin.from('accounts').select('id, code').in('code', REQUIRED_CODES)
  const map: SaleAccountMap = {}
  for (const a of data ?? []) map[a.code] = a.id
  return map
}

/**
 * 販売明細1件 → 売上仕訳 を起票する。
 * 既に source='sale_line', source_id=saleLine.id の仕訳があれば、削除してから再挿入（上書き方式）。
 */
export async function postSaleEntry(saleLine: {
  id: string
  item_name: string
  unit_price: number
  quantity: number
  occurred_at: string
}): Promise<void> {
  await deleteSaleEntry(saleLine.id)

  const accountMap = await buildAccountMap()
  for (const code of REQUIRED_CODES) {
    if (!accountMap[code]) {
      console.error(`postSaleEntry: account code ${code} not found, skipping`)
      return
    }
  }

  const entry = buildSaleEntry({
    saleLineId: saleLine.id,
    itemName: saleLine.item_name,
    unitPrice: saleLine.unit_price,
    quantity: Number(saleLine.quantity),
    occurredAt: saleLine.occurred_at,
  }, accountMap)
  if (!entry) return

  const err = validateEntry(entry)
  if (err) {
    console.error('postSaleEntry validateEntry failed:', err)
    return
  }

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      entry_date: entry.entryDate,
      description: entry.description,
      source: 'sale_line',
      source_id: saleLine.id,
    })
    .select().single()
  if (headerErr || !header) {
    console.error('postSaleEntry header insert failed:', headerErr)
    return
  }
  const lines = entry.lines.map((l, i) => ({
    journal_entry_id: header.id,
    account_id: l.accountId,
    side: l.side,
    amount: l.amount,
    line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    console.error('postSaleEntry lines insert failed:', linesErr)
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
  }
}

/**
 * 販売明細の売上仕訳を削除する（source='sale_line' AND source_id={id}）。
 */
export async function deleteSaleEntry(saleLineId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('journal_entries').delete()
    .eq('source', 'sale_line').eq('source_id', saleLineId)
  if (error) console.error('deleteSaleEntry failed:', error)
}
```

- [ ] **Step 3: 型チェック＋全テスト＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "reservation.test" | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/inventory/serverConsume.ts lib/accounting/serverSalePosting.ts && git commit -m "feat(b4): server-side consume + sale posting helpers"
```

Expected: 既存の reservation.test エラーのみ、テスト 179 pass。

---

### Task 6: 既存 sale-lines API に B-4 フックを統合

**Files:**
- Modify: `app/api/admin/reservations/[id]/sale-lines/route.ts`
- Modify: `app/api/admin/reservations/[id]/sale-lines/[lineId]/route.ts`

- [ ] **Step 1: `app/api/admin/reservations/[id]/sale-lines/route.ts` の POST に統合**

ファイル末尾の `return NextResponse.json({ saleLine: data }, { status: 201 })` を、データ挿入成功後にフック呼び出し → 返却する形に変更する。具体的には、現在の `const { data, error } = await supabaseAdmin.from('sale_lines').insert(...).select().single()` の後の `if (error) ...` の後に以下を挿入:

```typescript
  // B-4: 在庫消費 + 売上仕訳（best-effort）
  try {
    const { postSaleConsumption } = await import('@/lib/inventory/serverConsume')
    await postSaleConsumption({
      id: data.id, item_id: data.item_id,
      quantity: Number(data.quantity), occurred_at: data.occurred_at,
    })
  } catch (e) { console.error('postSaleConsumption failed:', e) }
  try {
    const { postSaleEntry } = await import('@/lib/accounting/serverSalePosting')
    await postSaleEntry({
      id: data.id, item_name: data.item_name,
      unit_price: data.unit_price, quantity: Number(data.quantity),
      occurred_at: data.occurred_at,
    })
  } catch (e) { console.error('postSaleEntry failed:', e) }
```

- [ ] **Step 2: `app/api/admin/reservations/[id]/sale-lines/[lineId]/route.ts` の DELETE に統合**

現在の `const { error } = await supabaseAdmin.from('sale_lines').delete()...` の **直前** に、reverse 処理を追加:

```typescript
  // B-4: 紐づく在庫消費・売上仕訳を先に削除（best-effort）
  try {
    const { deleteSaleConsumption } = await import('@/lib/inventory/serverConsume')
    await deleteSaleConsumption(params.lineId)
  } catch (e) { console.error('deleteSaleConsumption failed:', e) }
  try {
    const { deleteSaleEntry } = await import('@/lib/accounting/serverSalePosting')
    await deleteSaleEntry(params.lineId)
  } catch (e) { console.error('deleteSaleEntry failed:', e) }
```

- [ ] **Step 3: 型チェック＋全テスト＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "reservation.test" | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/api/admin/reservations/[id]/sale-lines" && git commit -m "feat(b4): wire sale-line CRUD to consume + sale posting hooks"
```

---

### Task 7: 期末棚卸 API + UI

**Files:**
- Create: `app/api/admin/accounting/inventory-snapshot/route.ts`
- Create: `components/admin/accounting/InventorySnapshotManager.tsx`
- Create: `app/admin/(dashboard)/accounting/inventory-snapshot/page.tsx`
- Modify: `app/admin/(dashboard)/accounting/page.tsx`

- [ ] **Step 1: `app/api/admin/accounting/inventory-snapshot/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildSnapshotLines, buildSnapshotJournal } from '@/lib/inventory/snapshot'
import { validateEntry } from '@/lib/accounting/validateEntry'

const REQUIRED_CODES = ['105', '501']

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('inventory_snapshots').select('*')
    .order('fiscal_year', { ascending: false }).order('snapshot_type')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshots: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fiscalYear?: number; type?: 'closing' | 'opening' }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { fiscalYear, type } = body
  if (!Number.isInteger(fiscalYear) || (type !== 'closing' && type !== 'opening'))
    return NextResponse.json({ error: 'fiscalYear / type が必要です' }, { status: 400 })

  // 重複チェック
  const { data: dup } = await supabaseAdmin
    .from('inventory_snapshots').select('id')
    .eq('fiscal_year', fiscalYear).eq('snapshot_type', type).maybeSingle()
  if (dup) return NextResponse.json({ error: 'すでに作成済みです（先に取消してから再生成してください）' }, { status: 409 })

  // 棚卸対象品目を取得
  const { data: items } = await supabaseAdmin
    .from('items').select('id, current_quantity, cost_price')
    .eq('track_inventory', true).eq('is_active', true)
  const inputs = (items ?? []).map(i => ({
    itemId: i.id, quantity: Number(i.current_quantity), costPrice: i.cost_price,
  }))
  const snap = buildSnapshotLines(inputs)

  // 科目コード→ID マップ
  const { data: accs } = await supabaseAdmin
    .from('accounts').select('id, code').in('code', REQUIRED_CODES)
  const accountMap: Record<string, string> = {}
  for (const a of accs ?? []) accountMap[a.code] = a.id
  for (const code of REQUIRED_CODES) {
    if (!accountMap[code]) return NextResponse.json({ error: `必要な勘定科目（${code}）が見つかりません` }, { status: 400 })
  }

  // snapshot 行 + 仕訳起票
  const { data: snapshot, error: sErr } = await supabaseAdmin
    .from('inventory_snapshots')
    .insert({ fiscal_year: fiscalYear, snapshot_type: type, total_value: snap.totalValue })
    .select().single()
  if (sErr || !snapshot) return NextResponse.json({ error: sErr?.message ?? 'スナップショット作成失敗' }, { status: 500 })

  if (snap.lines.length > 0) {
    await supabaseAdmin.from('inventory_snapshot_lines').insert(
      snap.lines.map(l => ({ snapshot_id: snapshot.id, item_id: l.itemId, quantity: l.quantity, cost_price: l.costPrice, value: l.value })),
    )
  }

  let journalEntryId: string | null = null
  const entry = buildSnapshotJournal(snap.totalValue, fiscalYear, type, accountMap)
  if (entry) {
    const err = validateEntry(entry)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    const { data: header } = await supabaseAdmin
      .from('journal_entries').insert({
        entry_date: entry.entryDate, description: entry.description,
        source: 'inventory_snapshot', source_id: snapshot.id,
      }).select().single()
    if (header) {
      journalEntryId = header.id
      await supabaseAdmin.from('journal_lines').insert(
        entry.lines.map((l, i) => ({
          journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
        })),
      )
      await supabaseAdmin.from('inventory_snapshots').update({ journal_entry_id: header.id }).eq('id', snapshot.id)
    }
  }

  return NextResponse.json({
    snapshot: { ...snapshot, journal_entry_id: journalEntryId },
    totalValue: snap.totalValue, missingCostCount: snap.missingCostCount,
  }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const { data: snap } = await supabaseAdmin.from('inventory_snapshots').select('journal_entry_id').eq('id', id).maybeSingle()
  if (snap?.journal_entry_id) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', snap.journal_entry_id)
  }
  const { error } = await supabaseAdmin.from('inventory_snapshots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: `components/admin/accounting/InventorySnapshotManager.tsx` を作成**

```tsx
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
```

- [ ] **Step 3: `app/admin/(dashboard)/accounting/inventory-snapshot/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import InventorySnapshotManager from '@/components/admin/accounting/InventorySnapshotManager'

export const revalidate = 0

export default async function InventorySnapshotPage() {
  const { data: snaps } = await supabaseAdmin
    .from('inventory_snapshots').select('*')
    .order('fiscal_year', { ascending: false }).order('snapshot_type')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">期末棚卸</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">
        年末に「期末棚卸」を実行すると、在庫評価額（数量 × 原価）を計算し、繰越商品 / 仕入高 の振替仕訳が自動生成されます（三分法）。翌年1月1日に「期首振替」を実行して仕入高に戻します。
      </p>
      <InventorySnapshotManager initialSnaps={snaps ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: 会計トップの LINKS に追加**

`app/admin/(dashboard)/accounting/page.tsx` の `LINKS` 配列を読み、末尾に追加:
```typescript
  { href: '/admin/accounting/inventory-snapshot', label: '期末棚卸', icon: '📦' },
```

- [ ] **Step 5: 型チェック・ビルド・全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "reservation.test" | head -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 型エラーなし・ビルド成功（`/admin/accounting/inventory-snapshot` がルートに出る）・全テスト pass（179）

- [ ] **Step 6: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/api/admin/accounting/inventory-snapshot" components/admin/accounting/InventorySnapshotManager.tsx "app/admin/(dashboard)/accounting/inventory-snapshot" "app/admin/(dashboard)/accounting/page.tsx" && git commit -m "feat(b4): inventory snapshot API + UI + accounting link"
```

---

### Task 8: SQL 実行 ＋ デプロイ

**Files:** なし

- [ ] **Step 1: SQL をクリップボードにコピー（UTF-16LE）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && node -e "const fs=require('fs');const{spawnSync}=require('child_process');const t=fs.readFileSync('supabase/migrations/015_b4_consume_and_inventory.sql','utf8').replace(/^﻿/,'');spawnSync('clip',{input:Buffer.from(t,'utf16le')});console.log('copied')"
```

- [ ] **Step 2: Supabase SQL エディタで実行**

翻訳オフの Chrome で `https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new` を開き、貼り付けて Run。Expected: 「Success. No rows returned」

- [ ] **Step 3: テーブル＋科目確認**

```bash
node -e "
const https=require('https');
const k='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/inventory_snapshots?limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('inventory_snapshots:',r.statusCode===200?'OK':'ERR '+r.statusCode));
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/inventory_snapshot_lines?limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('inventory_snapshot_lines:',r.statusCode===200?'OK':'ERR '+r.statusCode));
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/accounts?code=eq.105&select=code,name',headers:{Authorization:'Bearer '+k,apikey:k}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('account 105:',d))});
"
```
Expected: 両テーブル OK、`[{\"code\":\"105\",\"name\":\"繰越商品\"}]`

- [ ] **Step 4: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`
