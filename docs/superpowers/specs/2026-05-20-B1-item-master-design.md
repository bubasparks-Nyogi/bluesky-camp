# サブプロジェクト B-1：商品/メニュー マスタ 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS）
> 位置づけ: 新構想「在庫・原価・お客様明細」の土台。B-1（品目マスタ）→ B-2（在庫管理）→ B-3（お客様向け明細領収書）→ B-4（売上原価の会計連携）の最初。

---

## B1-0. 全体構想と本書の範囲

| 順 | サブプロジェクト | 内容 |
|----|----------------|------|
| **B-1** | 商品/メニュー マスタ | 品目（食材・料理・物販等）＋レシピ（料理→構成食材）★本書 |
| B-2 | 在庫管理 | 在庫の動き（入庫/消費/**廃棄**/棚卸調整）。数量管理 |
| B-3 | お客様向け明細領収書 | 滞在中の利用明細をメール送付 |
| B-4 | 売上原価の会計連携 | 販売/消費/廃棄時に在庫減＋原価・廃棄損の仕訳 |

本書は **B-1 のみ**。在庫数量・廃棄・売上連携・会計仕訳は範囲外（後続）。

---

## B1-1. ゴール
食材・料理・物販などの品目を1つのマスタで登録・管理でき、料理には構成食材（レシピ）を登録して原価が自動計算される状態。お客様に販売できる品目（is_sellable）が区別され、後続の在庫・明細・原価連携の土台になる。

---

## B1-2. データモデル（マイグレーション `012_items.sql`）

### ① `items`（品目マスタ）
```sql
CREATE TABLE items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL,                 -- 'ingredient'|'dish'|'goods'|'drink'|'supply'
  unit            text NOT NULL DEFAULT '個',
  sale_price      integer,                        -- 販売価格（販売可の品目のみ・円）
  cost_price      integer,                        -- 原価/仕入単価（円）
  is_sellable     boolean NOT NULL DEFAULT true,
  track_inventory boolean NOT NULL DEFAULT false, -- 在庫管理する（B-2用。廃棄もここで扱う）
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_items_category ON items (category);
CREATE INDEX idx_items_active   ON items (is_active);
ALTER TABLE items ENABLE ROW LEVEL SECURITY;  -- 公開ポリシーなし（service role 経由のみ）
```
カテゴリ和名: ingredient=食材 / dish=料理 / goods=物販 / drink=ドリンク / supply=消耗品

### ② `item_components`（レシピ：料理→構成食材）
```sql
CREATE TABLE item_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id    uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  component_item_id uuid NOT NULL REFERENCES items(id),
  quantity          numeric NOT NULL CHECK (quantity > 0),
  UNIQUE (parent_item_id, component_item_id)
);
CREATE INDEX idx_item_components_parent ON item_components (parent_item_id);
ALTER TABLE item_components ENABLE ROW LEVEL SECURITY;
```

### 規則
- 料理の原価は構成食材の `cost_price × quantity` 合計で**自動計算**（保存しない）。
- 数量は小数可（200g 等）。金額は整数（円）。
- 料理が自分自身を直接/間接に含む循環は禁止（`detectRecipeCycle` で防止）。

---

## B1-3. 純粋ロジック（`lib/items/`・テスト対象）

### 型 `lib/items/types.ts`
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

### `computeDishCost(lines: ComponentCostLine[]): { cost: number; hasMissingCost: boolean }`（`lib/items/cost.ts`）
- `cost` = Σ `(costPrice ?? 0) × quantity` を四捨五入した整数。
- `hasMissingCost` = いずれかの行で `costPrice` が null なら true（原価未設定の食材を含む警告）。
- 空配列 → `{ cost: 0, hasMissingCost: false }`。

### `validateItem(input: ItemInput): string | null`（`lib/items/validate.ts`）
順に検証、最初の違反の日本語メッセージ、無ければ null:
1. `name` 空 → `'名称を入力してください'`
2. `category` が有効5値でない → `'カテゴリが不正です'`
3. `salePrice`/`costPrice` が null 以外で「0以上の整数」でない → `'金額は0以上の整数で入力してください'`
4. `isSellable === true` かつ `salePrice == null` → `'販売する品目は販売価格を入力してください'`

### `validateComponent(parentId, componentId, quantity): string | null`（`lib/items/validate.ts`）
1. `parentId === componentId` → `'自分自身を構成食材にできません'`
2. `quantity` が正の数でない → `'数量は正の数で入力してください'`
3. OK → null

### `detectRecipeCycle(parentId, componentId, edges: ComponentEdge[]): boolean`（`lib/items/cycle.ts`）
`componentId` を起点に既存 `edges`（parent→component の有向辺）を辿り、`parentId` に到達できれば循環（true）。新しい辺 `parent→component` を追加する前に呼ぶ。多段（A→B→C→A）も検出。

---

## B1-4. 画面とAPI

### 画面
管理ナビに **「🍖 商品・メニュー管理」**（`/admin/items`）を追加。
- `/admin/items`（Server Component）: 品目一覧（カテゴリフィルタ・追加・編集・無効化）。各料理の自動計算原価を表示。
- クライアント `ItemManager`: 品目の追加・編集フォーム（名称/カテゴリ/単位/販売価格/原価/販売可否/在庫管理）。
- クライアント `RecipeEditor`: カテゴリが料理のとき表示。構成食材（プルダウン＋数量）の追加/削除、原価の自動計算表示、循環エラー表示。

### API（admin 認証必須・`getUser()` でガード、`supabaseAdmin` で DML）
| ルート | メソッド | 内容 |
|--------|---------|------|
| `/api/admin/items` | GET | 全品目（sort_order, category 順）＋各料理の自動計算原価 |
| | POST | 作成（`validateItem`）|
| `/api/admin/items/[id]` | PATCH | 更新（`validateItem`）|
| | DELETE | 削除。`item_components` で食材として使用中なら 409（無効化のみ）|
| `/api/admin/items/[id]/components` | GET | 構成食材一覧 |
| | POST | 追加（`validateComponent` ＋ `detectRecipeCycle`、循環は 400）|
| `/api/admin/items/[id]/components/[componentId]` | DELETE | 構成食材削除 |

原価付与: 一覧/詳細 API で全 `item_components` ＋ 食材 `cost_price` を取得し `computeDishCost` で算出して返す（サーバ計算・非保存）。

---

## B1-5. テスト方針

| 関数 | ケース |
|------|--------|
| `computeDishCost` | 通常合計 / 小数数量 / 原価null混在で hasMissingCost=true / 空で0 |
| `validateItem` | 正常 / 名称なし / 不正カテゴリ / 販売可で価格なし / 負・非整数の金額 |
| `validateComponent` | 正常 / quantity 0・負 / 自己参照 |
| `detectRecipeCycle` | 循環あり→true / なし→false / 多段(A→B→C→A)→true |

API・画面は既存 admin パターン準拠。E2E は後続とまとめて。

---

## B1-6. ファイル構成
| ファイル | 種別 |
|---------|------|
| `supabase/migrations/012_items.sql` | 新規 |
| `lib/items/types.ts` / `cost.ts` / `validate.ts` / `cycle.ts` | 新規 |
| `lib/items/__tests__/*.test.ts` | 新規 |
| `app/api/admin/items/route.ts` ほか components API 群 | 新規 |
| `components/admin/items/ItemManager.tsx` / `RecipeEditor.tsx` | 新規 |
| `app/admin/(dashboard)/items/page.tsx` | 新規 |
| `app/admin/(dashboard)/layout.tsx` | 修正（ナビ追加）|

---

## B1-7. 申し送り（後続サブプロジェクトへ）
- **廃棄**（食材の傷み・物販破損）は B-2（在庫管理）で「在庫の動き」の一種（入庫/消費/廃棄/棚卸調整）として実装し、B-4 で廃棄損を計上する。B-1 マスタは `track_inventory` で土台対応済み。
- お客様向け明細領収書（B-3）は `is_sellable = true` の品目を対象にする。
- 料理販売時の食材自動消費（レシピ展開）は B-2/B-4 で `item_components` を使って実装。

## B1-8. 非対象
- 在庫数量・入出庫・廃棄の記録（B-2）
- お客様明細・メール送付（B-3）
- 売上原価・廃棄損の会計仕訳（B-4）
- 消費税区分（当面免税）
