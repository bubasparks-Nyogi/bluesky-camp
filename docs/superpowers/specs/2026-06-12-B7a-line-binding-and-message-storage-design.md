# サブプロジェクト B-7a：LINE 連携基盤（紐付け + 会話保存）設計書

**作成日**: 2026-06-12
**前提**: B-1〜B-5 本番稼働中。B-6（Stripeキャッシュレス決済）は決済プロバイダ選定中のため保留。

## B-7 全体像

B-7 は「お客様⇄オーナーの LINE 会話から AI が `sale_lines` を自動抽出する」基盤。実装スコープが大きいため2分割:

- **B-7a（本書）**: LIFF 紐付け + LINE Webhook 受信 + `line_messages` 保存
- **B-7b（後続）**: AI 抽出（Claude Haiku 4.5）+ `sale_drafts` + 管理画面承認UI + 通知

B-7a 完了時点で「実際の会話データ」が DB に蓄積され、B-7b の AI プロンプト調整素材になる。

---

## B-7a 目的

1. お客様が予約完了画面 / 確認メールから LIFF を開き、予約と LINE ユーザを紐付ける
2. 公式 LINE への発言（お客様・オーナー双方）を Webhook で受信し、滞在中の予約に紐付けて `line_messages` テーブルに保存する
3. B-7b の AI 抽出に必要なコンテキスト（直近10件取得）を準備する

非目的（B-7a スコープ外）:
- AI による sale_lines 抽出
- `sale_drafts` テーブルと承認UI
- AI レスポンスとしての reply（B-7a は固定文言のみ）
- 未承認件数の push 通知

---

## アーキテクチャ

### (a) 紐付けフロー（LIFF）

```
予約完了画面 / 予約確認メール
       │ 「LINEで連絡する」ボタン (LIFF URL: https://liff.line.me/{LIFF_ID}?reservationId=<id>)
       ▼
LINE アプリ内で /line/bind ページが起動
       │ liff.init() → liff.getProfile() で line_user_id
       │ liff.getIDToken() で idToken
       ▼
POST /api/line/bind { reservationId, lineUserId, idToken }
       │ サーバ側で LINE Verify API に idToken を投げて sub == lineUserId 確認
       ▼
reservations.line_user_id = lineUserId
       ▼
完了画面 → liff.openWindow() で公式 LINE のトーク画面に遷移
```

### (b) 受信フロー（Messaging API Webhook）

```
お客様 / オーナーが LINE で発言
       ▼
POST /api/line/webhook  (LINE Platform から)
       │ X-Line-Signature を HMAC-SHA256 で検証
       ▼
events[] を解析
       │ 各 message イベント:
       │   - source.userId = lineUserId
       │   - sender 判定: lineUserId === LINE_OWNER_USER_ID ? 'owner' : 'customer'
       │   - 滞在中予約解決: reservations WHERE line_user_id=? AND checkin<=today<=checkout
       ▼
line_messages に INSERT (reservation_id 可空, raw_event jsonb 保持)
       ▼
reply（固定文言、customer 発言時のみ）
       │ 「メッセージありがとうございます ✨ 内容を確認してご連絡します」
       │ (B-7b で AI レスポンスに置換)
```

### 新規依存

- クライアント: `@line/liff`
- サーバ: 既存 `crypto`（署名検証は Node 標準で実装、`@line/bot-sdk` は導入しない）

---

## データモデル

### 変更1: `reservations` テーブルに `line_user_id` カラム追加

```sql
ALTER TABLE reservations ADD COLUMN line_user_id text;
CREATE INDEX idx_reservations_line_user_id ON reservations(line_user_id)
  WHERE line_user_id IS NOT NULL;
```

- 1 予約 = 1 LINE user（リピーターは予約毎に再 bind）
- 部分インデックスで紐付け済みのみ高速検索
- NULL 許可（紐付け前 / 不要な予約も存在）

### 変更2: 新テーブル `line_messages`

```sql
CREATE TABLE line_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE SET NULL,
  line_user_id    text NOT NULL,
  line_message_id text UNIQUE,                 -- LINE event の message.id（冪等性）
  sender          text NOT NULL CHECK (sender IN ('customer','owner','system')),
  message_type    text NOT NULL,               -- text, sticker, image など LINE 仕様準拠
  text            text,                        -- text 以外は null
  raw_event       jsonb NOT NULL,              -- webhook イベント原文
  received_at     timestamptz NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_line_messages_reservation ON line_messages(reservation_id, received_at DESC);
CREATE INDEX idx_line_messages_user        ON line_messages(line_user_id,    received_at DESC);
ALTER TABLE line_messages ENABLE ROW LEVEL SECURITY;
```

ポイント:
- `reservation_id` NULL 許可: 未紐付け user / 滞在期間外発言も全件保存
- `line_message_id UNIQUE`: LINE Webhook 再送による重複防止（INSERT 時 `ON CONFLICT DO NOTHING`）
- `sender`: customer / owner / system（自動 reply）
- `raw_event jsonb`: LINE 仕様変更時もデータ復元可
- B-7b の AI 抽出は `WHERE reservation_id = ? ORDER BY received_at DESC LIMIT 10` で取得

---

## エンドポイントとファイル構成

### 新規エンドポイント

| メソッド | パス | 役割 |
|------|------|------|
| GET  | `/line/bind`         | LIFF ページ（クライアント） |
| POST | `/api/line/bind`     | LIFF から呼ばれる: `{reservationId, lineUserId, idToken}` |
| POST | `/api/line/webhook`  | LINE Platform からの webhook 受信 |

### 新規ファイル

```
lib/line/
  ├── verifySignature.ts            純粋関数 (HMAC-SHA256)
  ├── verifyIdToken.ts              LINE Verify API 叩く
  ├── resolveActiveReservation.ts   純粋関数 (日付と予約配列から1件返す)
  ├── classifySender.ts             純粋関数 (lineUserId / OWNER_LINE_USER_ID)
  └── __tests__/
        ├── verifySignature.test.ts
        ├── resolveActiveReservation.test.ts
        └── classifySender.test.ts

app/line/bind/
  └── page.tsx                       LIFF クライアント

app/api/line/
  ├── bind/route.ts                  POST: 紐付け確定
  └── webhook/route.ts               POST: イベント受信

supabase/migrations/
  └── 016_line_integration.sql       ALTER reservations + CREATE line_messages
```

### 変更ファイル

- 予約完了画面 (`app/reserve/lookup/[id]/page.tsx` 周辺): 「LINEで連絡する」ボタン追加
- 予約確認メール (B-1 で作成済テンプレ): 同ボタン追加
- `.env.example`: `LINE_CHANNEL_SECRET`, `NEXT_PUBLIC_LIFF_ID`, `LINE_OWNER_USER_ID` 追加

### 設計原則

純粋ロジック（署名検証、滞在中予約解決、sender 判定）は `lib/line/` に分離してテストファースト。API ルートは Supabase 呼び出しと純粋関数呼び出しのみで薄く保つ。

---

## UI

### 予約完了画面に LINE 連携ボタン

```
┌────────────────────────────────────────┐
│ ご予約が確定しました ✨                │
│                                        │
│ 予約番号: ABC12345                     │
│ 2026-07-15 〜 2026-07-16（1泊）        │
│                                        │
│ ┌──────────────────────────────────┐   │
│ │ 📱 LINEで連絡する                │   │
│ │ 当日の追加注文や質問はLINEで     │   │
│ │ お気軽にどうぞ                   │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

ボタンの href: `https://liff.line.me/{NEXT_PUBLIC_LIFF_ID}?reservationId=<id>`

### 予約確認メールにも同ボタン

既存メールテンプレ内に HTML ボタンとして追加。

### LIFF ページ `/line/bind`

3 状態（読み込み中 / 成功 / 失敗）。warm-* パレット、Tailwind、`max-w-md mx-auto` のスマホ最適化。

```
[読み込み中] LINE連携の設定中... ⏳
[成功]       ✅ 連携完了！ → [LINEのトーク画面を開く] (liff.openWindow)
[失敗]       ⚠️ 連携できませんでした<理由> オーナーまでご連絡ください。
```

---

## セキュリティ・エラー処理

### (1) LINE Webhook 署名検証

```
X-Line-Signature = HMAC-SHA256(LINE_CHANNEL_SECRET, raw_body) base64
不一致 → 401 即返却、line_messages に保存しない
```

`lib/line/verifySignature.ts` で純粋関数化（テスト: 正しい署名通る / 改ざんは弾く / ヘッダ欠落 等）。

raw_body は Next.js App Router で `await req.text()` から取得（JSON.parse 前のバイト列が必須）。

### (2) LIFF bind の二段階検証

```
クライアント: liff.getProfile() で userId 取得 + liff.getIDToken() で idToken 取得
       ▼
POST /api/line/bind { reservationId, lineUserId, idToken }
       ▼ サーバ側:
1. idToken を LINE Verify API (https://api.line.me/oauth2/v2.1/verify) に POST
   → sub と lineUserId 一致確認
2. reservations を id で取得、checkin_date >= today - 30days（古すぎ予約は拒否）
3. line_user_id 上書き保存
```

idToken 検証の目的: クライアント fetch を改ざんして別の line_user_id を送り込むのを防ぐ。

既に他予約に bind 済みの line_user_id を新予約に bind するのは許可（リピーター想定通り）。

### (3) Webhook 受信時の予約解決

```typescript
function resolveActiveReservation(lineUserId, today, reservations): Reservation | null
// reservations を line_user_id で絞ったあと、checkin <= today <= checkout を満たす
// 最新の created_at を返す。なければ null。
```

- ヒット: `line_messages.reservation_id = 解決値`
- ヒットしない: `reservation_id = NULL` で保存（記録は残す）
- 紐付け未済 user から受信 → 固定 reply:「予約番号と一緒に再度メッセージください」

### (4) sender 判定

```typescript
function classifySender(lineUserId, ownerLineUserId): 'customer' | 'owner'
```

`LINE_OWNER_USER_ID` 未設定なら全て customer 扱い + warn ログ。

### (5) Webhook 例外処理

- DB エラー: 500 を返すと LINE が再送し重複が増える → 200 を返しつつ Vercel ログに ERROR 出力
- 冪等性: LINE event の `message.id` を `line_message_id UNIQUE` カラムに保存し `ON CONFLICT DO NOTHING`

### (6) reply 内容（B-7a）

- customer 発言 → 「メッセージありがとうございます ✨ 内容を確認してご連絡します」（reply 1回、無料カウント）
- owner 発言 → reply しない
- B-7b で AI レスポンスに置換予定

---

## テスト戦略

### 純粋ロジック（vitest, TDD）

| ファイル | テスト件数 |
|------|------|
| `lib/line/__tests__/verifySignature.test.ts`            | 6 |
| `lib/line/__tests__/resolveActiveReservation.test.ts`   | 5 |
| `lib/line/__tests__/classifySender.test.ts`             | 3 |

詳細:
- verifySignature: 正しい署名通る / 改ざんは弾く / 空ヘッダ弾く / 空ボディ / 大文字小文字 / 別シークレットで生成された署名弾く
- resolveActiveReservation: 滞在中ヒット / チェックイン前は null / チェックアウト後は null / 同 user 複数予約は最新 / 未登録 user は null
- classifySender: owner一致→owner / 不一致→customer / OWNER 未設定→customer + warn

### 統合系（手動 + Vercel 本番で実機確認）

| 確認項目 | 方法 |
|------|------|
| LIFF bind が動く | 自分のLINEで実予約を作って LIFF URL タップ → `reservations.line_user_id` 値が入る |
| Webhook 受信 | LINE のテスト相手から1通送る → `line_messages` に1行 INSERT |
| 署名検証 | LINE Developers コンソールの「Verify」ボタンで OK 表示 |
| sender 判定 | 自分（オーナー）からも1通 → sender = 'owner' で保存 |
| 予約解決 | チェックイン日前のメッセージ → `reservation_id = NULL` で保存 |
| 冪等性 | 同じ message.id の event を2回送り込んで line_messages が1行のみ |

### スコープ外（B-7b へ繰越）

- AI 抽出ロジックのテスト
- sale_drafts 関連テスト
- 承認 UI テスト
- AI レスポンスの reply

### 既存テスト総数

189 → B-7a 完了時 **203 件**（+14）見込み。

---

## 環境変数

| 名前 | 用途 | 取得元 |
|------|------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | Push / Reply API 用 | LINE Developers > Messaging API（既設） |
| `LINE_CHANNEL_SECRET`       | Webhook 署名検証 | LINE Developers > Messaging API |
| `NEXT_PUBLIC_LIFF_ID`       | クライアント LIFF init | LINE Developers > LIFF アプリ |
| `LINE_OWNER_USER_ID`        | オーナー判定 | 自身の LINE で /api/line/webhook 経由で取得 |

---

## 運用フロー（オペレーターが行う設定作業）

実装完了後、LINE Developers コンソールで以下を実施（コードで完結しない部分）:

1. Messaging API チャネルに **LIFF アプリ追加**: Endpoint URL = `https://bluesky-camp.vercel.app/line/bind`、Size = Compact
2. **Webhook URL** 設定: `https://bluesky-camp.vercel.app/api/line/webhook` + Verify ボタンで疎通確認
3. **応答メッセージ** OFF（自動応答が reply と競合しないように）
4. **Webhook の利用** ON
5. 上記環境変数を Vercel に設定（Production / Preview）

---

## 後続（B-7b プレビュー）

B-7a で蓄積された `line_messages` を元に:
- お客様メッセージ受信時、直近10件と items 一覧を Haiku 4.5 に渡し JSON 構造化抽出
- `sale_drafts` に登録案を INSERT
- 管理画面に承認UI（スマホ最適化）
- 未承認3件以上たまったら1回オーナー push（無料枠節約）

B-7a の `verifySignature` / `classifySender` / `line_messages` テーブルは B-7b でそのまま再利用。

