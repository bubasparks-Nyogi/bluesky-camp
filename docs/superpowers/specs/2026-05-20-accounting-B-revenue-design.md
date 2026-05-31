# 会計システム サブプロジェクトB：売上連携 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS）
> 前提: サブプロジェクトA（複式簿記コア）完了済み。本書はその上に「予約 → 会計」の自動仕訳を載せる **B：売上連携** の設計。

---

## B-0. 全体方針の再掲（A-0 より）

- 売上計上: **宿泊完了日**（役務提供完了）。事前入金は前受金で受け、完了時に売上へ振替
- 消費税: 当面免税（税区分欄のみ）
- e-Tax 直接送信: 非対象

## B-0.1 このサブプロジェクトで決めたこと

- 売上計上は **半自動**：チェックアウト日を過ぎた予約を「売上計上待ち」一覧に出し、個別／一括で計上
- 支払方法は **管理画面でのみ記録**（`payment_method`: 現地払い/事前振込）。公開予約フォームは変更しない
- 事前振込の入金仕訳は **入金日の記録をトリガーに自動計上**
- 事前振込は **全額前受**（手付金・一部入金は扱わない）
- キャンセル時の会計処理も **Bに含める**（計上済み予約のキャンセルを自動仕訳化）

---

## B-1. ゴール

予約のライフサイクル（事前入金 → 宿泊完了 → 必要ならキャンセル）に対応する複式簿記仕訳が、管理画面の操作から正確かつ二重なく自動生成される状態。

---

## B-2. データモデル変更

会計テーブル（A で作成）は**変更なし**。`reservations` に2列追加し、`journal_entries.source`/`source_id`（A で用意済み）を活用する。

### `reservations` への追加（マイグレーション `009_reservation_payment.sql`）

```sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method text;  -- 'onsite' | 'prepaid' | NULL
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paid_at date;          -- 入金日（事前振込のみ）
```

- `payment_method`: 管理画面でのみ設定。`'onsite'`=現地払い、`'prepaid'`=事前振込、`NULL`=未設定
- `paid_at`: 事前振込の入金日。記録すると前受金仕訳が起きる

### 仕訳の冪等キー（`source_id` 規約）

1予約から最大3種類の仕訳が出るため、`source='reservation'` 固定、`source_id` を予約IDとフェーズの複合にする:

| フェーズ | source_id | 意味 |
|---------|-----------|------|
| 前受金計上 | `"{reservationId}:prepayment"` | 事前入金の受領 |
| 売上計上 | `"{reservationId}:revenue"` | 宿泊完了の売上 |
| キャンセル | `"{reservationId}:cancellation"` | キャンセル処理 |

計上前に同一 `source_id` の `journal_entries` が無いか確認し、二重計上を防ぐ。予約側に計上済みフラグは持たせず、会計テーブルの存在を単一情報源とする。

---

## B-3. 仕訳パターン（金額は予約の `total_amount` 全額）

勘定科目は科目マスタの **コード**で参照する（IDは環境ごとに異なるため、コード→ID を実行時に解決）。

### ① 前受金計上（事前振込・入金日記録時）
```
借方  普通預金 (102)   total_amount
貸方  前受金   (203)   total_amount
```

### ② 売上計上（宿泊完了・計上待ち一覧から）
事前振込（前受金を振替）:
```
借方  前受金   (203)   total_amount
貸方  売上高   (401)   total_amount
```
現地払い（当日現金受取）:
```
借方  現金     (101)   total_amount
貸方  売上高   (401)   total_amount
```

### ③ キャンセル処理（計上済み予約のキャンセル時）
キャンセル料 = 既存 `lib/cancellation` の計算結果 `fee`。

事前振込で前受金を受領済み（前受金を取り崩し、キャンセル料を雑収入、残額を返金）:
```
借方  前受金   (203)   total_amount
貸方  雑収入   (402)   fee                （fee > 0 のときのみ行を出す）
貸方  普通預金 (102)   total_amount − fee  （返金額 > 0 のときのみ行を出す）
```
- fee = 0：全額返金（雑収入行なし）
- fee = total_amount：返金行なし（全額雑収入）
- 借方合計（total_amount）= 貸方合計（fee + 返金額）で常に一致

現地払い（入金なし）:
- fee > 0：`借 売掛金(103) / 貸 雑収入(402)  fee`（キャンセル料を請求計上）
- fee = 0：仕訳なし（`null`）

### 科目コード定数
```typescript
const ACCT = {
  cash:      '101',  // 現金
  bank:      '102',  // 普通預金
  receivable:'103',  // 売掛金
  advance:   '203',  // 前受金
  sales:     '401',  // 売上高
  misc:      '402',  // 雑収入
} as const
```

---

## B-4. 純粋ロジック（`lib/accounting/reservationPosting.ts`・テスト対象）

DB 非依存の純粋関数として実装し、Vitest でテストする。

### 型
```typescript
import type { JournalEntryInput } from './types'

export type PaymentMethod = 'onsite' | 'prepaid'
export type PostingPhase  = 'prepayment' | 'revenue' | 'cancellation'

export interface ReservationForPosting {
  id: string
  totalAmount: number
  paymentMethod: PaymentMethod
  checkinDate: string
  checkoutDate: string
}

/** コード → account_id の解決マップ（実行時に accounts テーブルから構築） */
export type AccountCodeMap = Record<string, string>  // 例 { '101': '<uuid>', ... }
```

### `buildReservationEntry(reservation, phase, accountMap, opts?): JournalEntryInput | null`
- `phase='prepayment'`: paymentMethod が 'prepaid' のとき ① を返す。'onsite' なら `null`
- `phase='revenue'`: paymentMethod により ②（前受金/現金）を出し分け
- `phase='cancellation'`: `opts.fee`（キャンセル料）と paymentMethod により ③ を組む。現地払い・fee=0 は `null`
- `entryDate`: prepayment は `opts.paidAt`、revenue は `checkoutDate`、cancellation は `opts.cancelledAt`
- `description`: 例 `"予約売上 {checkinDate} {ゲスト名省略可}"`（摘要は簡潔に）
- 生成した仕訳は必ず借貸一致（テストで `validateEntry()` を通す）

### `filterPostableReservations(reservations, today, postedRevenueIds): ReservationForPosting[]`
売上計上待ちの抽出（純粋関数）:
- status が確定（'confirmed'）
- `checkoutDate <= today`
- `paymentMethod` が設定済み（null でない）
- `id` が `postedRevenueIds`（既に `:revenue` 仕訳がある予約ID集合）に含まれない
- キャンセルでない

---

## B-5. API（admin 認証必須）

### `POST /api/admin/accounting/post-reservation`
ボディ: `{ reservationId, phase }`（phase: 'prepayment' | 'revenue'）
処理:
1. 予約を取得（payment_method, total_amount 等）
2. 同一 `source_id`（`{id}:{phase}`）の仕訳が既にあれば `{ skipped: true }` を返す（冪等）
3. accounts からコード→IDマップを構築
4. `buildReservationEntry()` で仕訳を生成（null なら `{ skipped: true }`）
5. `validateEntry()` 通過後、`journal_entries`（source='reservation', source_id）＋ `journal_lines` を挿入（A の挿入パターン・失敗時ロールバック）
6. 成功時 `{ entryId }`

「全部計上」は、計上待ち各予約に対しこのAPIを `phase='revenue'` で順次呼ぶ（フロント側ループ、各結果を集計表示）。

### `PATCH /api/admin/reservations/[id]/payment`（新規 or 既存予約APIに追加）
ボディ: `{ payment_method?, paid_at? }`
処理:
1. 予約の `payment_method` / `paid_at` を更新
2. `paid_at` が新規に設定され、かつ `payment_method='prepaid'` の場合、`{id}:prepayment` 仕訳が無ければ前受金仕訳を**同期的に**生成（失敗時は更新ごとエラー＝400/500で返し、不整合を防ぐ）

### キャンセルフック（既存キャンセルAPIに追加）
既存のキャンセル処理（`reservations` を cancelled に更新＋メール送信している箇所）に、会計仕訳生成を **best-effort** で追加:
1. その予約に `:prepayment` か `:revenue` 仕訳が存在するか確認
2. 存在すれば `buildReservationEntry(…, 'cancellation', …, { fee })` で仕訳生成（`{id}:cancellation` で冪等）
3. 失敗してもキャンセル自体は成功させる（ログのみ。メール送信と同じ best-effort 思想）

---

## B-6. UI

### ① 予約管理に支払方法・入金日（管理画面のみ）
既存の予約管理（一覧 or 詳細）に、各予約の **支払方法プルダウン**（現地払い/事前振込）と **入金日入力**（事前振込時のみ表示）を追加。保存で `PATCH .../payment` を呼ぶ。入金日保存時に前受金仕訳が自動計上される旨を小さく表示。

### ② 「予約売上計上」ページ（新規）
- パス: `app/admin/(dashboard)/accounting/reservation-posting/page.tsx`
- 会計トップに「💰 予約売上計上」カードを追加（LINKS 配列に追記）
- Server Component で計上待ち（`filterPostableReservations` 適用）を取得し、クライアント `ReservationPostingList` に渡す
- クライアント: 各予約に「計上」ボタン＋上部「全部計上」。計上は `POST /post-reservation`（phase='revenue'）。結果（計上済み/スキップ/失敗）を行ごとに表示

### ③ キャンセル
UI 追加なし（既存キャンセル操作にサーバ側フックが乗るだけ）。

---

## B-7. 冪等性・エラー処理

- **冪等**: 計上前に `source='reservation'` かつ該当 `source_id` の存在を確認しスキップ。「全部計上」の重複実行に耐える
- **検証**: 生成仕訳は必ず `validateEntry()` を通してから保存（借貸一致保証）
- **同期/best-effort の使い分け**:
  - 入金日記録・売上計上 → **同期**（失敗時はエラー表示し確定させない）
  - キャンセル仕訳 → **best-effort**（失敗してもキャンセルは成立、ログのみ）
- **科目欠落**: 必要な科目コードが accounts に無い/無効化されている場合、「必要な勘定科目（前受金など）が見つかりません」と明示エラー
- **金額源の単一化**: キャンセル料は `lib/cancellation` の結果を使用（B で再計算しない）

---

## B-8. テスト方針

| 対象 | ケース |
|------|--------|
| `buildReservationEntry` prepayment | 事前振込→借普通預金/貸前受金、現地払い→null |
| `buildReservationEntry` revenue | 事前振込→借前受金/貸売上高、現地払い→借現金/貸売上高 |
| `buildReservationEntry` cancellation | 前受金あり・fee>0（雑収入＋返金）、前受金あり・fee=total（返金なし）、前受金あり・fee=0（雑収入なし）、現地払い・fee=0（null）、現地払い・fee>0（借売掛金/貸雑収入）|
| 全生成仕訳 | `validateEntry()` を通る（借貸一致）|
| `filterPostableReservations` | 確定のみ・チェックアウト経過・支払方法設定済み・既計上除外・キャンセル除外 |

API・UI は既存 admin パターンに準拠。E2E は後続サブプロジェクト完了後にまとめて追加。

---

## B-9. 触る既存ファイル

| ファイル | 変更 |
|---------|------|
| `supabase/migrations/009_reservation_payment.sql` | 新規（reservations に2列）|
| `lib/accounting/reservationPosting.ts` | 新規（純粋ロジック）|
| `lib/accounting/__tests__/reservationPosting.test.ts` | 新規（テスト）|
| `app/api/admin/accounting/post-reservation/route.ts` | 新規 |
| 予約の支払更新API（`app/api/admin/reservations/[id]/payment/route.ts` 等） | 新規 or 既存に追加 |
| 既存キャンセルAPIルート | フック追加 |
| `app/admin/(dashboard)/accounting/reservation-posting/page.tsx` | 新規 |
| `components/admin/accounting/ReservationPostingList.tsx` | 新規 |
| 予約管理の支払方法・入金日UI（既存予約管理コンポーネント） | 追加 |
| `app/admin/(dashboard)/accounting/page.tsx` | LINKS に「予約売上計上」追加 |

---

## B-10. 非対象

- 手付金・一部入金（全額前受のみ）
- 売上科目の細分化（レンタル等も売上高に集約）
- 消費税の区分経理（当面免税）
- 固定資産・減価償却（→ D）、決算書（→ E）
- Stripe 連携の自動入金検知（入金日は手動記録）
