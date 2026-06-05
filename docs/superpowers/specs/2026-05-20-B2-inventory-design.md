# サブプロジェクト B-2：在庫管理 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS）
> 位置づけ: B-1（品目マスタ）の上に在庫数量を載せる。B-1 → **B-2（在庫管理）** → B-3（明細領収書）→ B-4（売上原価の会計連携）。

---

## B2-0. 範囲と方針

- 在庫は **履歴台帳 ＋ 現在数量キャッシュ** で管理（監査可能・再計算可能）。
- B-2 で手動操作するのは **入庫 / 廃棄 / 棚卸調整** の3種類。**販売による消費（レシピ展開）は B-4 で自動**。
- **B-2 は数量管理のみ。仕訳は作らない**（仕入経費は C のレシート/経費入力で計上済み。三分法の期末棚卸評価は B-4 でまとめる）。これにより二重計上を防ぐ。
- 棚卸調整は **実数入力 → 差分を自動記録**。**在庫がマイナスになる操作は防ぐ**。
- 対象は `items.track_inventory = true` の品目のみ。

---

## B2-1. ゴール
食材・物販などの在庫数量を、入庫・廃棄・棚卸調整で正確に増減・記録でき、現在庫と動き履歴を管理画面で確認できる。後続（B-4）の売上消費・期末棚卸評価の土台になる。

---

## B2-2. データモデル（マイグレーション `013_inventory.sql`）

### ① `stock_movements`（在庫の動き・履歴台帳）
```sql
CREATE TABLE stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type           text NOT NULL,        -- 'in' | 'disposal' | 'adjustment'（将来 'consume' 追加可）
  quantity_delta numeric NOT NULL,     -- 符号つき増減（入庫=+, 廃棄=−, 調整=±）
  note           text,
  occurred_at    date NOT NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_stock_movements_item ON stock_movements (item_id);
CREATE INDEX idx_stock_movements_date ON stock_movements (occurred_at);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
```

### ② `items` に現在数量キャッシュ
```sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS current_quantity numeric NOT NULL DEFAULT 0;
```
- 動き記録のたびに `current_quantity += quantity_delta`。
- 履歴から再計算可能（キャッシュずれ修復用）。

### 記録ルール
| 種類 | 入力 | quantity_delta |
|------|------|----------------|
| 入庫 'in' | 数量（>0）| +数量 |
| 廃棄 'disposal' | 数量（>0・現在庫以下）| −数量 |
| 棚卸調整 'adjustment' | 実数（≥0）| 実数 − 現在庫（±）|

廃棄が現在庫を超えたらエラー（マイナス防止）。

---

## B2-3. 純粋ロジック（`lib/inventory/`・テスト対象）

### 型 `lib/inventory/types.ts`
```typescript
export type MovementType = 'in' | 'disposal' | 'adjustment'
export type DeltaResult = { delta: number } | { error: string }
```

### `computeQuantity(deltas: number[]): number`（`lib/inventory/quantity.ts`）
`quantity_delta` の合計。空配列 → 0。小数対応。

### `buildMovementDelta(type: MovementType, value: number, currentQty: number): DeltaResult`（`lib/inventory/movement.ts`）
- `'in'`: `value > 0` → `{ delta: value }`、それ以外 → `{ error: '入庫数は正の数で入力してください' }`
- `'disposal'`:
  - `value <= 0` → `{ error: '廃棄数は正の数で入力してください' }`
  - `value > currentQty` → `` { error: `在庫が足りません（現在庫 ${currentQty}）` } ``
  - else → `{ delta: -value }`
- `'adjustment'`: `value < 0` → `{ error: '実数は0以上で入力してください' }`、else → `{ delta: value - currentQty }`
- 不正 type → `{ error: '不明な操作です' }`

---

## B2-4. API（admin 認証必須・`getUser()`、`supabaseAdmin`）

| ルート | メソッド | 内容 |
|--------|---------|------|
| `/api/admin/inventory/movements` | POST | 動き記録。`{ itemId, type, value, occurredAt, note? }`。下記フロー |
| `/api/admin/inventory/movements?itemId=...` | GET | 指定品目の履歴（occurred_at 降順）|
| `/api/admin/inventory/recompute` | POST | 全品目の `current_quantity` を履歴から再計算 |

### POST movements フロー
1. 品目を取得。`track_inventory !== true` → 400「在庫管理対象外の品目です」。
2. `buildMovementDelta(type, value, current_quantity)` → `error` があれば 400。
3. `stock_movements` に `{ item_id, type, quantity_delta: delta, note, occurred_at }` を挿入。
4. `items.current_quantity = current_quantity + delta` に更新。失敗時は挿入した movement を削除（ロールバック）。
5. `{ currentQuantity: 更新後 }` を返す。

### POST recompute フロー
- 全 `stock_movements` を item ごとに合計し、各 `items.current_quantity` を上書き。

---

## B2-5. UI

管理ナビに **「📦 在庫管理」**（`/admin/inventory`）を追加。
- Server Component: `track_inventory = true` の品目＋現在数量を取得しクライアントへ。
- クライアント `InventoryManager`:
  - 行ごと：名称・カテゴリ・**現在庫（単位つき、0以下は赤強調）**。
  - 各行に操作フォーム：種類（入庫/廃棄/棚卸調整）＋数量(または実数)＋発生日(既定=今日)＋メモ → 「記録」。
  - 行展開で**動き履歴**（日付・種類・増減・メモ）を表示（GET movements）。
  - 記録成功で現在庫を即時更新、履歴に追加。

---

## B2-6. テスト方針
| 関数 | ケース |
|------|--------|
| `computeQuantity` | 通常合計 / 空で0 / 小数 |
| `buildMovementDelta` in | 正常+value / 0・負でエラー |
| `buildMovementDelta` disposal | 正常−value / 在庫超過エラー / 0・負エラー / ちょうど在庫分OK |
| `buildMovementDelta` adjustment | 実数>現在庫=+差分 / 実数<現在庫=−差分 / 実数=現在庫=0 / 負でエラー |

API・画面は既存 admin パターン準拠。E2E は後続とまとめて。

---

## B2-7. ファイル構成
| ファイル | 種別 |
|---------|------|
| `supabase/migrations/013_inventory.sql` | 新規 |
| `lib/inventory/types.ts` / `quantity.ts` / `movement.ts` | 新規 |
| `lib/inventory/__tests__/*.test.ts` | 新規 |
| `app/api/admin/inventory/movements/route.ts` | 新規 |
| `app/api/admin/inventory/recompute/route.ts` | 新規 |
| `components/admin/inventory/InventoryManager.tsx` | 新規 |
| `app/admin/(dashboard)/inventory/page.tsx` | 新規 |
| `app/admin/(dashboard)/layout.tsx` | 修正（ナビ追加）|

---

## B2-8. 申し送り（後続へ）
- **B-3**: `is_sellable = true` の品目の利用明細をお客様にメール。
- **B-4**: ①販売消費＝レシピ（`item_components`）展開で食材在庫を自動減（`stock_movements` type='consume' を追加）②期末棚卸評価仕訳（`current_quantity × cost_price`）③売上原価。B-2 は type に `'consume'` を将来追加できる前提で設計済み（現状 in/disposal/adjustment）。

## B2-9. 非対象
- 仕訳生成（数量管理のみ。会計は C / B-4）
- 販売による消費・レシピ自動展開（B-4）
- 発注点・自動発注などの高度機能
- ロット・賞味期限管理
