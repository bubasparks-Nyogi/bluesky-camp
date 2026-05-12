# @blueSky キャンプ場 — Phase 2 設計書（管理パネル＋ルール・同意）

**作成日**: 2026-05-12  
**ステータス**: 設計確定・実装計画待ち  
**リポジトリ**: `bluesky-camp`

---

## 概要

Phase 2 は2つの柱で構成される。

1. **既存サイト追加**：持ち込み規定・ペット規定・免責事項の表示（`/rules` ページ＋ホームページ RULES セクション）と、予約フローへの利用規約同意ステップ追加。
2. **管理パネル**：Supabase Auth でログイン保護された `/admin` 配下の管理画面（予約カレンダー・一覧・料金設定・レンタル管理・日程ブロック）。

---

## A. 既存サイト追加

### A-1. ホームページ RULES セクション

`components/home/Rules.tsx` を新設し、`app/page.tsx` の PLAN と BOOKING の間に挿入する。

表示内容（要約）：

| 項目 | 内容 |
|------|------|
| 持ち込み可能 | 食品・飲料、キャンプ道具一式、ペット道具 |
| ペット | 小型動物・全長80㎝程度まで可。犬種・頭数は要相談 |
| 禁止事項 | 花火・直火（指定焚き火台以外）・騒音 |
| 注意事項 | 損害・紛失・破損の責任は利用者負担。詳細は利用規約参照 |

セクション下部に「利用規約の全文はこちら →」リンクを設置（`/rules` へ）。

### A-2. /rules ページ（全文）

`app/rules/page.tsx` を新設。以下5章構成でテキスト表示。

1. **持ち込み規定**：食品・キャンプ道具・ペット道具は持ち込み可。危険物・違法薬物は禁止。
2. **ペット規定**：小型動物（全長80㎝程度まで）可。ペットによる損害（施設・備品への傷・汚染等）はすべて利用者負担。
3. **損害補填規定**：利用者またはペットが施設・設備に損害（大規模清掃・補修・器物破損等）を与えた場合、実費を請求する。
4. **免責事項**：宿泊中・使用中に発生した持ち込み道具・レンタル道具・ペットの破損・紛失・死亡等について、施設は一切責任を負わない。
5. **キャンセルポリシー**：
   - 7日前まで：無料
   - 3〜6日前：50%
   - 前日・当日：100%

### A-3. 予約フロー「利用規約」ステップ追加

`components/reserve/StepTerms.tsx` を新設。`ReserveFlow.tsx` の Step 7（お客様情報）の直後、Step 8（金額確認）の前に挿入。

ステップ内容：
- キャンセルポリシーの全文表示
- 損害補填・免責事項の要約表示
- 3つのチェックボックス（全チェック必須で「次へ」活性化）：
  - ☑ キャンセルポリシーに同意します
  - ☑ 損害補填規定に同意します
  - ☑ 免責事項に同意します

`STEP_LABELS` に `'利用規約'` を追加し、`StepIndex` を `0〜9` に拡張する。

### A-4. DB 変更

```sql
-- reservations テーブルへのカラム追加
ALTER TABLE reservations
  ADD COLUMN agreed_to_terms_at TIMESTAMPTZ;
```

`POST /api/reservations` で `agreed_to_terms_at: new Date().toISOString()` を保存する。

---

## B. 管理パネル

### ルーティング

| パス | 内容 |
|------|------|
| `/admin/login` | Supabase Auth ログイン画面 |
| `/admin` | 月間予約カレンダー（デフォルト今月） |
| `/admin/reservations` | 予約一覧・ステータス変更・詳細閲覧 |
| `/admin/pricing` | 料金設定（pricing テーブル編集） |
| `/admin/rental-items` | レンタル道具管理（rental_items テーブル編集） |
| `/admin/blocked-dates` | 日程ブロック（任意の日を受付停止） |

### 認証フロー

- Supabase Auth（メール＋パスワード）を使用
- `app/admin/layout.tsx` でセッション確認。未ログインは `/admin/login` にリダイレクト
- ログインはオーナー1名のみ想定。Supabase Dashboard でユーザーを手動作成
- `lib/supabase-server.ts` に `createServerClient`（@supabase/ssr）を追加

### B-1. 予約カレンダー（`/admin`）

- 月間カレンダー表示（前月・次月ナビゲーション）
- 予約済み日：オレンジ背景＋お客様名
- 日程ブロック日：グレー背景＋理由
- 空き日：白背景
- 日付クリック → 予約詳細モーダル or ブロック解除UI

### B-2. 予約一覧（`/admin/reservations`）

- テーブル表示：日程・お客様名・宿泊タイプ・合計金額・ステータス
- ステータス変更ボタン（confirmed → cancelled）
- 詳細モーダル：全予約情報（オプション・連絡先・同意日時）表示

### B-3. 料金設定（`/admin/pricing`）

- pricing テーブルの各行を編集可能なフォームで表示
- 金額を変更して「保存」ボタン押下で UPDATE
- active フラグのオン/オフ切り替え

### B-4. レンタル道具管理（`/admin/rental-items`）

- 道具一覧表示（名前・料金・available フラグ）
- 新規追加フォーム
- 既存品の料金変更・一時無効化（available = false）
- 削除は論理削除（available = false のまま）

### B-5. 日程ブロック（`/admin/blocked-dates`）

- カレンダー or 日付入力でブロックする日を選択
- 理由テキスト入力（例：「メンテナンス」「家族利用」）
- ブロック一覧と解除ボタン

### B-6. DB 追加

```sql
CREATE TABLE blocked_dates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL UNIQUE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
-- service_role のみ書き込み可（anon は読み取りのみ）
CREATE POLICY "blocked_dates_read" ON blocked_dates FOR SELECT USING (TRUE);
```

`GET /api/availability` を修正し、`blocked_dates` も「×（満室）」として返すようにする。

---

## ファイル構成（主要追加・変更ファイル）

```
bluesky-camp/
├── app/
│   ├── page.tsx                          # RULES セクション追加
│   ├── rules/
│   │   └── page.tsx                      # 利用規約全文ページ
│   └── admin/
│       ├── layout.tsx                    # 認証ガード・サイドバー
│       ├── login/page.tsx                # Supabase Auth ログイン
│       ├── page.tsx                      # 予約カレンダー
│       ├── reservations/page.tsx         # 予約一覧
│       ├── pricing/page.tsx              # 料金設定
│       ├── rental-items/page.tsx         # レンタル管理
│       └── blocked-dates/page.tsx        # 日程ブロック
├── components/
│   ├── home/
│   │   └── Rules.tsx                     # RULES セクション
│   ├── reserve/
│   │   └── StepTerms.tsx                 # 利用規約同意ステップ
│   └── admin/
│       ├── ReservationCalendar.tsx       # 月間カレンダー（Client）
│       ├── ReservationList.tsx           # 予約一覧テーブル
│       ├── PricingForm.tsx               # 料金設定フォーム
│       ├── RentalItemsForm.tsx           # レンタル管理フォーム
│       └── BlockedDatesForm.tsx          # 日程ブロックフォーム
├── lib/
│   └── supabase-server.ts                # SSR用Supabaseクライアント
└── supabase/
    └── migrations/
        └── 002_phase2.sql                # agreed_to_terms_at・blocked_dates
```

---

## 追加パッケージ

```bash
npm install @supabase/ssr
```

`@supabase/ssr` を使いサーバーサイドでセッション検証を行う（Next.js App Router 対応）。

---

## Phase 3 への接続

- `agreed_to_terms_at` はキャンセルポリシー適用の証拠として経理フェーズで参照
- `blocked_dates` は Phase 3 の稼働率集計から除外する際に活用
