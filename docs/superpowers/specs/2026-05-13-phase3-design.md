# @blueSky Phase 3 設計ドキュメント

**日付:** 2026-05-13  
**スコープ:** B（お客様向け予約確認・キャンセル）→ C（管理画面 予約編集）→ 決済後付け対応

---

## 概要

Phase 2 で完成した管理パネルと予約フローを土台に、以下3つを追加する。

1. **B: お客様向け予約確認・キャンセル申請**
2. **C: 管理画面 予約全項目編集**
3. **決済後付け対応**（Stripe 未設定時でも予約が完了できる）

---

## B: お客様向け予約確認・キャンセル

### ページ構成

| URL | 役割 |
|-----|------|
| `/reserve/lookup` | 予約番号（8桁）＋メールアドレスで検索するフォーム |
| `/reserve/lookup/[id]` | 予約詳細表示 ＋ キャンセルボタン |

### アクセス方法

- **メールリンク経由**: `/reserve/lookup/[UUID]` をメール本文に記載。UUID（36文字）は推測不可能なためトークンとして機能する。Phase A（メール送信実装後）から有効。
- **ダイレクト検索**: 予約番号の先頭8文字 ＋ 登録メールアドレスで照合。今すぐ使える。

### 予約詳細の表示内容

- 予約番号・ステータス
- チェックイン / チェックアウト日
- 宿泊タイプ・各オプション（サウナ・ペット・EHU・送迎）
- レンタル道具
- 合計金額
- キャンセルボタン（ステータスが `cancelled` / `confirmed` 以外のとき表示）

### キャンセルフロー

1. 「キャンセルする」ボタンをクリック
2. キャンセル料を自動計算して確認モーダルを表示

   | チェックインまでの日数 | キャンセル料 |
   |----------------------|-------------|
   | 7日以上              | 無料（0%）  |
   | 3〜6日               | 合計金額の50% |
   | 0〜2日（前日・当日）  | 合計金額の100% |

   ※ 「お支払いについては別途ご連絡します」の注記を表示（Phase A まで実請求なし）

3. 「キャンセルを確定する」ボタンで `status: 'cancelled'` に更新
4. 完了メッセージを表示

### 新規ファイル

| ファイル | 役割 |
|----------|------|
| `app/reserve/lookup/page.tsx` | 検索フォームページ（'use client'） |
| `app/reserve/lookup/[id]/page.tsx` | 予約詳細ページ（Server Component + キャンセルUI） |
| `components/reserve/CancelModal.tsx` | キャンセル確認モーダル（'use client'） |
| `app/api/reservations/lookup/route.ts` | GET: 部分ID＋メールで予約照合（認証不要） |
| `app/api/reservations/[id]/cancel/route.ts` | POST: キャンセル実行（メール照合で所有権確認） |
| `lib/cancellation.ts` | キャンセル料計算ロジック ＋ テスト |

### キャンセルAPI セキュリティ

- `POST /api/reservations/[id]/cancel` はリクエストボディに `email` を要求
- DB の `guest_email` と一致しない場合は 403 を返す
- すでに `cancelled` の場合は 409 を返す

---

## C: 管理画面 予約全項目編集

### 新規ファイル

| ファイル | 役割 |
|----------|------|
| `app/admin/(dashboard)/reservations/[id]/page.tsx` | 予約編集ページ（Server Component で初期値取得） |
| `components/admin/ReservationEditForm.tsx` | 編集フォーム（'use client'） |
| `app/api/admin/reservations/[id]/route.ts` | PUT: 予約全件更新（認証必須） |

### 編集できる項目

| 項目 | 入力タイプ |
|------|-----------|
| チェックイン日 | date input |
| チェックアウト日 | date input |
| 宿泊タイプ（複数選択可） | checkbox group |
| サウナ・ペット・EHU | checkbox |
| 送迎人数・送迎駅 | number + text |
| お客様氏名 | text |
| お客様メール | email |
| お客様電話 | tel |
| 合計金額（手動上書き） | number（デフォルトは自動計算値） |
| ステータス | select（pending / confirmed / cancelled） |

### UX

- 予約一覧（`ReservationList`）の詳細モーダルに「✏️ 編集」ボタンを追加
- クリックで `/admin/reservations/[id]` へ遷移
- 保存後は予約一覧ページに戻る
- 合計金額は宿泊タイプ・オプション変更時に自動再計算されるが、手動上書きも可能

---

## 決済後付け対応

### 方針

`STRIPE_SECRET_KEY` が `sk_test_placeholder` の場合、決済をスキップして予約を直接保存する。Stripe の本番キーを `.env.local` に設定すれば自動的に決済フローが有効になる。

### 変更ファイル

| ファイル | 変更内容 |
|----------|---------|
| `app/api/reservations/route.ts` | Stripe キーがプレースホルダーなら PaymentIntent 作成をスキップ。`clientSecret: null` を返す |
| `components/reserve/StepPayment.tsx` | `clientSecret` が不要な場合、「予約を確定する」ボタンで直接 `/reserve/complete` へ遷移 |

### 判定ロジック

```typescript
const stripeEnabled = !process.env.STRIPE_SECRET_KEY?.includes('placeholder')
```

---

## テスト方針

| テストファイル | 内容 |
|---------------|------|
| `lib/cancellation.test.ts` | キャンセル料計算（7日前・5日前・当日・0日）の境界値テスト |
| 既存 `lib/pricing.test.ts` | 変更なし（引き続き通過すること確認） |

---

## ファイルマップ（Phase 3 全体）

```
app/
├── reserve/
│   └── lookup/
│       ├── page.tsx                          # 検索フォーム（新規）
│       └── [id]/
│           └── page.tsx                      # 予約詳細（新規）
└── admin/
    └── (dashboard)/
        └── reservations/
            └── [id]/
                └── page.tsx                  # 予約編集（新規）

app/api/
├── reservations/
│   ├── route.ts                              # 決済スキップ対応（修正）
│   ├── lookup/route.ts                       # GET 予約照合（新規）
│   └── [id]/
│       └── cancel/route.ts                   # POST キャンセル（新規）
└── admin/
    └── reservations/
        └── [id]/
            └── route.ts                      # PUT 予約更新（新規）

components/
├── reserve/
│   ├── CancelModal.tsx                       # キャンセル確認モーダル（新規）
│   └── StepPayment.tsx                       # 決済スキップ対応（修正）
└── admin/
    └── ReservationEditForm.tsx               # 編集フォーム（新規）

lib/
└── cancellation.ts                           # キャンセル料計算（新規）
```
