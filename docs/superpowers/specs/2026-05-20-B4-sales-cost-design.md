# サブプロジェクト B-4：売上原価の会計連携 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS）
> 位置づけ: B-1（品目）/ B-2（在庫）/ B-3（領収書）の上に「販売による会計仕訳と在庫消費」を載せ、年末の期末棚卸まで完結させる。これでサブプロジェクト B シリーズの会計面が一通り揃う。
> 後続: B-5（PDF・お客様DL）/ B-6（キャッシュレスまとめ決済）/ B-7（LINE注文受付）

---

## B4-0. 範囲と方針

- **販売明細(B-3)→売上仕訳** を即時自動生成（販売の編集・削除も同期、上書き方式）。
- **販売明細→在庫消費** を即時自動生成（料理はレシピ展開、物販はその品目）。マイナス在庫は許可。
- **期末棚卸**（三分法）：年末に在庫評価額を「繰越商品」へ振替する仕訳を生成。
- **売上の借方は売掛金(103)固定** — B-6 でキャッシュレスまとめ決済を実装する前提。決済時は B-6 が `借 普通預金 / 貸 売掛金` を起票する想定。
- **廃棄損は別科目では扱わない**（三分法で既に仕入高に含まれる前提）。
- 「販売消費」は B-2 で予約済みの `stock_movements.type='consume'` を追加。スキーマ変更なし、`note` に sale_line 参照を保持。
- 純粋ロジックは TDD で先に固める。

---

## B4-1. ゴール

販売明細を1行追加するだけで、

- 売上仕訳が自動で起票される（売掛金 / 売上高）
- 料理ならレシピ展開して食材在庫が減る／物販なら品目自身が減る
- 編集・削除すれば仕訳と在庫も追随する（上書き方式）

さらに年末に「期末棚卸」ボタンで在庫評価額を繰越商品へ振替する仕訳が生成され、青色申告に必要な数字が揃う。

---

## B4-2. データモデル

### マイグレーション `015_b4_consume_and_inventory.sql`

```sql
-- ① stock_movements に note 検索用インデックス（type='consume' で note に 'sale_line:{id}' を保持）
CREATE INDEX IF NOT EXISTS idx_stock_movements_note ON stock_movements (note);

-- ② 「繰越商品」科目（三分法・期末棚卸用）
INSERT INTO accounts (code, name, category, normal_balance, sort_order)
VALUES ('105', '繰越商品', 'asset', 'debit', 45)
ON CONFLICT (code) DO NOTHING;

-- ③ 期末棚卸スナップショット
CREATE TABLE inventory_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year      integer NOT NULL,
  snapshot_type    text NOT NULL,             -- 'closing' | 'opening'
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

### `source_id` 規約（既存 `journal_entries.source / source_id`）

| 由来 | source | source_id |
|------|--------|-----------|
| 販売 | `'sale_line'` | sale_lines.id |
| 期末棚卸（期末・期首振替）| `'inventory_snapshot'` | inventory_snapshots.id |

これにより販売の編集・削除時に「対応する仕訳」を一発で特定・削除できる。

### `stock_movements.type` 拡張
B-2 で予約済みの `'consume'` を追加（type は text なのでスキーマ変更不要）。`note` には `'sale_line:{uuid}'` を保持し、編集・削除時に検索キーとして使う。

---

## B4-3. 純粋ロジック

### `lib/inventory/consume.ts`

```typescript
export interface ConsumptionLine {
  itemId: string
  quantity: number  // 減らす数量（正の数）
}

export interface ItemLite {
  id: string
  category: 'ingredient' | 'dish' | 'goods' | 'drink' | 'supply'
  trackInventory: boolean
}

export interface ComponentLine {
  componentItemId: string
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
}): ConsumptionLine[]
```

### `lib/accounting/saleEntry.ts`

```typescript
import type { JournalEntryInput } from './types'

/** コード→ID の解決マップ */
export type SaleAccountMap = Record<string, string>

export interface SaleEntryInput {
  saleLineId: string
  itemName: string
  unitPrice: number
  quantity: number
  occurredAt: string
}

/**
 * 販売明細1件 → 売上仕訳。
 * - amount = Math.round(unit_price × quantity)
 * - amount ≤ 0 → null
 * - 借方: 売掛金(103), 貸方: 売上高(401)
 * - 結果は validateEntry を通過する
 */
export function buildSaleEntry(input: SaleEntryInput, accountMap: SaleAccountMap): JournalEntryInput | null
```

### `lib/inventory/snapshot.ts`

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
  missingCostCount: number   // costPrice=null だった品目数（警告用）
}

/**
 * 棚卸対象品目から、明細＋合計＋警告件数を算出。
 * - quantity ≤ 0 はスキップ
 * - costPrice=null は value=0 ＋ missingCostCount++
 * - value = Math.round(quantity × costPrice)
 */
export function buildSnapshotLines(items: SnapshotInputItem[]): SnapshotResult

/**
 * 棚卸仕訳を組み立てる。
 * - type='closing': 借 繰越商品(105) / 貸 仕入高(501)
 * - type='opening': 借 仕入高(501) / 貸 繰越商品(105)
 * - totalValue ≤ 0 → null
 */
export function buildSnapshotJournal(
  totalValue: number,
  fiscalYear: number,
  type: 'closing' | 'opening',
  accountMap: Record<string, string>,
): JournalEntryInput | null
```

---

## B4-4. サーバ統合（販売明細 ⇄ 在庫・売上仕訳）

### `lib/accounting/serverSalePosting.ts`（新規）
- `postSaleEntry(saleLine, accountMap)`: 仕訳生成 → journal_entries+lines に挿入。`source='sale_line'`, `source_id=saleLine.id`
- `deleteSaleEntry(saleLineId)`: `source='sale_line' AND source_id=...` を削除（CASCADE で lines も消える）
- `replaceSaleEntry(saleLine, accountMap)`: delete → post（UPDATE用）

### `lib/inventory/serverConsume.ts`（新規）
- `postSaleConsumption(saleLine, item, components, itemLookup)`:
  1. `expandConsumption()` で対象を算出
  2. 各対象に対し `stock_movements` 挿入（type='consume', delta=-quantity, note=`sale_line:{id}`）
  3. 各 `items.current_quantity` を `-= quantity` 更新
- `deleteSaleConsumption(saleLineId)`:
  1. `stock_movements WHERE type='consume' AND note='sale_line:{id}'` を取得
  2. 各 movement の `quantity_delta` を逆向きに `current_quantity` に加算
  3. movement を削除

### 既存 API に統合

**`app/api/admin/reservations/[id]/sale-lines/route.ts` の POST**
- 既存の挿入後に:
  1. `postSaleConsumption()`
  2. `postSaleEntry()`
- 両方ベストエフォートで実行。失敗してもログのみ（販売明細自体は成功とする）

**`app/api/admin/reservations/[id]/sale-lines/[lineId]/route.ts` の DELETE**
- 削除前に `deleteSaleConsumption(lineId)` ＋ `deleteSaleEntry(lineId)` を実行。
- ベストエフォート（ログのみ）。`sale_lines` 削除は実行。

**PATCH（UPDATE）は今回作らない** — 削除→再追加で運用。

### キャンセル時
- 予約 cancelled → sale_lines は変更しない（残す）。仕訳・在庫も残す。
- 予約 DELETE → CASCADE で sale_lines は消えるが、`stock_movements` と仕訳は孤児になる。今回は許容（追加の cleanup ジョブは非対象）。

---

## B4-5. 期末棚卸 UI ＋ API

### API `/api/admin/accounting/inventory-snapshot`
| メソッド | 内容 |
|---------|------|
| `GET` | 全 snapshot 一覧（fiscal_year 降順）|
| `POST` | `{ fiscalYear, type: 'closing'\|'opening' }`。①対象品目（track_inventory=true）を取得 ②`buildSnapshotLines()` 算出 ③`inventory_snapshots` + `inventory_snapshot_lines` 挿入 ④`buildSnapshotJournal()` 仕訳起票 ⑤`snapshot.journal_entry_id` 更新 |
| `DELETE` | クエリ `?id=...`。snapshot を削除（CASCADE で lines、`journal_entries` も削除）|

`fiscal_year + snapshot_type` UNIQUE のため重複生成は DB レベルで拒否（409）。

### 画面 `/admin/accounting/inventory-snapshot`
- 会計トップ `LINKS` に「📦 期末棚卸」追加。
- `InventorySnapshotManager`（クライアント）:
  - 現年度の「実行」ボタン（type 選択：期末/期首振替）
  - 直近スナップショット一覧（年度・type・金額・仕訳ID・生成日時・取消ボタン）
  - 「原価未設定の品目あり」警告表示（`missingCostCount > 0`）

---

## B4-6. テスト

純粋関数のみテスト対象：

| 対象 | ケース |
|------|--------|
| `expandConsumption` | 料理→構成食材展開（量×販売数）/ 物販→自身 / track_inventory=false 品目スキップ / 構成食材の一部が track_off → そこだけスキップ / 数量0スキップ |
| `buildSaleEntry` | 通常（unit_price × quantity）/ 小数数量を四捨五入 / amount=0 → null / `validateEntry()` を通る |
| `buildSnapshotLines` | quantity × cost の合計 / cost=null は value=0＋カウント / quantity≤0スキップ |
| `buildSnapshotJournal` | closing 借繰越商品/貸仕入高 / opening 逆 / totalValue=0 で null / `validateEntry()` を通る |

API・UI・DB更新は手動確認。E2E は別途。

---

## B4-7. ファイル構成

| ファイル | 種別 |
|---------|------|
| `supabase/migrations/015_b4_consume_and_inventory.sql` | 新規 |
| `lib/inventory/consume.ts` | 新規（純粋）|
| `lib/inventory/snapshot.ts` | 新規（純粋）|
| `lib/inventory/__tests__/consume.test.ts` | 新規 |
| `lib/inventory/__tests__/snapshot.test.ts` | 新規 |
| `lib/inventory/serverConsume.ts` | 新規（サーバ）|
| `lib/accounting/saleEntry.ts` | 新規（純粋）|
| `lib/accounting/__tests__/saleEntry.test.ts` | 新規 |
| `lib/accounting/serverSalePosting.ts` | 新規（サーバ）|
| `app/api/admin/reservations/[id]/sale-lines/route.ts` | 修正（POST に在庫消費＋売上仕訳）|
| `app/api/admin/reservations/[id]/sale-lines/[lineId]/route.ts` | 修正（DELETE に在庫戻し＋売上仕訳削除）|
| `app/api/admin/accounting/inventory-snapshot/route.ts` | 新規 |
| `components/admin/accounting/InventorySnapshotManager.tsx` | 新規（クライアント）|
| `app/admin/(dashboard)/accounting/inventory-snapshot/page.tsx` | 新規 |
| `app/admin/(dashboard)/accounting/page.tsx` | 修正（LINKSに「期末棚卸」追加）|

---

## B4-8. 申し送り

- **B-5**: PDF出力＋お客様向け領収書再ダウンロードページ
- **B-6**: Stripe でチェックアウト時まとめ決済 → `借 普通預金 / 貸 売掛金` を Webhook 経由で自動起票（売掛金の消込）
- **B-7**: LINE注文受付（AI抽出）→ `sale_lines` を下書き化（B-4 のフックがそのまま発火）

## B4-9. 非対象
- 廃棄損の個別計上（三分法）
- 個別原価計算（先入先出・移動平均など。原価は `items.cost_price` 固定）
- 消費税の区分経理（免税前提）
- 売上原価行・P/L 表示・印刷（→ 別途サブプロジェクト E：決算書）
- キャンセル時の sale_lines 自動 cleanup（仕訳・在庫の孤児許容）
