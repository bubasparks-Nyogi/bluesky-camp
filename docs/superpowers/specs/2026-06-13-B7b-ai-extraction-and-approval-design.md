# サブプロジェクト B-7b：AI 抽出 + sale_drafts + 承認 UI 設計書

**作成日**: 2026-06-13
**前提**: B-7a（LINE 連携基盤）本番稼働中。B-1〜B-5 稼働中、B-6 保留。

## B-7b 目的

B-7a で蓄積される `line_messages` を元に、お客様メッセージ受信時に Claude Haiku 4.5 が `sale_lines` 登録案を即時抽出し、`sale_drafts` テーブルに保存する。オーナーは管理画面で1件ずつ確認・承認・拒否し、承認時に既存 B-4 ロジック経由で `sale_lines` 確定＋会計仕訳まで自動で繋がる。

非目的:
- Stripe 決済処理（B-6 で別途）
- 自動承認（必ずオーナーレビューを挟む）
- 多商品一括承認（1件ずつ）

---

## アーキテクチャ

### Webhook 拡張

B-7a の `/api/line/webhook` を拡張し、`line_messages` upsert 後に AI 抽出を同期実行する。

```
お客様メッセージ
       ▼
POST /api/line/webhook  (B-7a 既存)
       ▼
verifySignature / classifySender / resolveActiveReservation
       ▼
line_messages に upsert  (B-7a 既存)
       ▼
=== B-7b 新規 ===
sender === 'customer' AND reservation_id != null:
  1. 直近10件 line_messages 取得（同じ reservation、received_at DESC）
  2. items 一覧取得（active=true のみ）
  3. extractSaleDrafts(messages, items) を Haiku 4.5 で呼ぶ
     ・タイムアウト 4秒（Promise.race）
     ・失敗・空配列 → スキップ
  4. 抽出案 N 件を sale_drafts に INSERT
     ・1メッセージで複数商品 → 複数行（Q4=B 決定通り）
     ・status='pending' で開始
       ▼
reply 計算（B-7a 既存ロジック拡張）
  ・未承認件数 ≥ 1 なら reply 末尾に "\n※管理画面に登録案 N 件あります"
  ・未承認件数が 3 に達した初回のみ、オーナーに LINE push 通知（1日1回上限）
```

### 承認フロー

```
オーナーが管理画面で「承認」
       ▼
POST /api/admin/sale-drafts/:id/approve
       ▼
1. sale_drafts を id で取得（status='pending' 必須、それ以外は 409 Conflict）
2. item_id NULL → 400「商品を選択してください」
3. 既存 B-4 ロジック (postSale 相当) を呼ぶ:
   - sale_lines に INSERT
   - inventory 在庫減（マイナス許容 + warn）
   - 仕訳エントリ作成（売掛金 / 売上高）
4. sale_drafts.status='approved', approved_sale_line_id=新ID
5. 200 { saleLineId: ... }
```

### 拒否フロー

```
オーナーが「拒否」
       ▼
POST /api/admin/sale-drafts/:id/reject  body: { reason?: string }
       ▼
1. sale_drafts を id で取得（status='pending' 必須）
2. status='rejected', rejected_reason=reason
3. 200 { ok: true }
   行は残す（AI 精度改善データ）
```

---

## データモデル

### 新テーブル `sale_drafts`

```sql
CREATE TABLE sale_drafts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id          uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  source_line_message_id  uuid NOT NULL REFERENCES line_messages(id) ON DELETE CASCADE,
  -- AI抽出結果
  item_id                 uuid REFERENCES items(id),
  item_name_raw           text NOT NULL,
  unit_price              integer,
  quantity                numeric NOT NULL CHECK (quantity > 0),
  occurred_at             date NOT NULL,
  confidence              numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  -- ステータス
  status                  text NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  approved_sale_line_id   uuid REFERENCES sale_lines(id) ON DELETE SET NULL,
  rejected_reason         text,
  -- メタ
  raw_extraction          jsonb NOT NULL,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX idx_sale_drafts_reservation_pending
  ON sale_drafts(reservation_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX idx_sale_drafts_pending_all
  ON sale_drafts(created_at DESC)
  WHERE status = 'pending';

ALTER TABLE sale_drafts ENABLE ROW LEVEL SECURITY;
```

ポイント:
- `source_line_message_id`: 元発言を管理画面で表示するため
- `item_id NULL` 許可: AI 解決失敗時もドラフトとして残し、オーナーが選び直す
- `confidence`: 全行保存（Q2=A）、UI フィルタに使う
- `rejected` 行も残す: AI 精度改善データ
- 部分インデックス2本で一覧クエリ高速化

### 変更なし

`sale_lines` / `items` / `line_messages` / `reservations` / `inventory` テーブルはそのまま。

---

## AI 抽出ロジック

### 関数シグネチャ (`lib/ai/extractSaleDrafts.ts`)

```typescript
interface ExtractedLine {
  itemId: string | null
  itemNameRaw: string
  quantity: number
  unitPrice: number | null
  confidence: number
}

interface ExtractInput {
  messages: { sender: 'customer'|'owner'; text: string; received_at: string }[]
  items: { id: string; name: string; unit_price: number }[]
}

export async function extractSaleDrafts(input: ExtractInput): Promise<ExtractedLine[]>
```

### モデル

- `claude-haiku-4-5-20251001`
- Tools API（構造化出力強制）
- max_tokens: 1024
- temperature: 0

### プロンプト構造

**System prompt**:
```
あなたは @blueSky キャンプ場の注文抽出アシスタントです。
お客様とオーナーのLINE会話から、お客様が「注文した商品」だけを抽出してください。
質問・雑談・キャンセル意図は抽出しないこと。
オーナーの確認発言（「生ビール2本ですね？」）にお客様が「はい」と答えた場合は抽出します。
items 一覧から最も近い id を選び、見つからない場合は null。
confidence は 0..1 で確信度を返してください（注文無しなら空配列）。
```

**User prompt（動的生成）**:
```
=== items ===
- id: itm-001, name: アサヒスーパードライ, unit_price: 500
- id: itm-002, name: コーラ, unit_price: 300
...

=== recent messages (oldest first) ===
[customer 2026-06-13 14:30] ビール2本ください
[owner 2026-06-13 14:31] アサヒでよろしいですか？
[customer 2026-06-13 14:32] はい
```

**Tool 定義**:
```json
{
  "name": "extract_sale_drafts",
  "input_schema": {
    "type": "object",
    "required": ["lines"],
    "properties": {
      "lines": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["itemId", "itemNameRaw", "quantity", "confidence"],
          "properties": {
            "itemId":      { "type": ["string","null"] },
            "itemNameRaw": { "type": "string" },
            "quantity":    { "type": "number" },
            "unitPrice":   { "type": ["number","null"] },
            "confidence":  { "type": "number", "minimum": 0, "maximum": 1 }
          }
        }
      }
    }
  }
}
```

### タイムアウト・エラー

| 場面 | 挙動 |
|------|------|
| Anthropic API タイムアウト（4秒）| 抽出スキップ、reply 通常、warn ログ |
| API 500 / 429 | 同上、status code ログ |
| AI が空配列 | 注文無しと判断、何もしない |
| `quantity ≤ 0` の異常値 | 当該 line をスキップ |
| Response の itemId が items に存在しない | NULL に正規化 |
| 全 line の confidence === 0 | 空配列扱い |

### 純粋関数化

- `lib/ai/buildPrompt.ts`: items + messages から system+user prompt 文字列を生成
- `lib/ai/parseExtractResponse.ts`: AI ツール呼び出しレスポンスを `ExtractedLine[]` に変換、正規化処理

---

## API エンドポイント

| メソッド | パス | 用途 |
|------|------|------|
| GET   | `/api/admin/sale-drafts`                              | 全予約横断 pending 一覧 |
| GET   | `/api/admin/sale-drafts?reservationId=<id>`           | 予約スコープ pending 一覧 |
| PATCH | `/api/admin/sale-drafts/[id]`                         | 承認前の編集 |
| POST  | `/api/admin/sale-drafts/[id]/approve`                 | 承認 |
| POST  | `/api/admin/sale-drafts/[id]/reject`                  | 拒否（body: `{ reason?: string }`）|

認証: 既存 `getUser()` + admin チェック（B-3 以降の admin API と同じ）。

一覧レスポンス例:
```json
{
  "drafts": [
    {
      "id": "...",
      "reservationId": "...",
      "reservationShortId": "ABC12345",
      "guestName": "山田 太郎",
      "checkinDate": "2026-06-20",
      "checkoutDate": "2026-06-21",
      "itemId": "itm-001",
      "itemName": "アサヒスーパードライ",
      "itemNameRaw": "ビール",
      "unitPrice": 500,
      "quantity": 2,
      "occurredAt": "2026-06-20",
      "confidence": 0.95,
      "sourceMessageText": "ビール2本ください",
      "createdAt": "2026-06-20T14:32:10Z"
    }
  ]
}
```

---

## UI

### 5-1: 管理画面トップ `/admin` にバッジ

既存ダッシュボードに「未承認の抽出案 [N]」カード追加。クリック → `/admin/sale-drafts`。

### 5-2: 一覧ページ `/admin/sale-drafts`

スマホ最適化、warm-* パレット。1案 = 1カード（縦並び）:

```
🏕 ABC12345 山田 太郎 様
2026-06-20 〜 06-21
──────────────────────────────
🛒 アサヒスーパードライ ×2  ¥1,000
   信頼度 ★★★★★ 95%
💬 「ビール2本ください」 2026-06-20 14:32

商品 [アサヒスーパードライ ▼] 数量 [2]
単価 [500]  日付 [2026-06-20]

[✅ 承認]  [❌ 拒否]
```

- デフォルト: AI 抽出値で表示（即「承認」で OK）
- 編集: 各 input は controlled、PATCH API で保存
- 信頼度バッジ: 0.0-0.4 赤 / 0.4-0.7 黄 / 0.7-1.0 緑
- item_id NULL: 商品プルダウンをオレンジ枠で目立たせる + 承認ボタン disabled
- 拒否: タップ → 理由入力モーダル（任意、未入力でも OK）

### 5-3: 予約詳細ページ `/admin/reservations/[id]` の新セクション

既存「販売履歴」セクションの下に追加:

```
📋 未承認の抽出案 (N件)
──────────────────────────────
[カード形式、5-2 と同じ]
```

`?reservationId=<id>` で絞った API を叩く。承認/拒否操作は共通コンポーネント。

### モバイル PWA

既存管理画面と同じ Tailwind パターン。`max-w-md` カード、`p-4 space-y-3`、ボタン `py-3 rounded-lg`。

---

## 通知

### reply 末尾埋め込み

抽出後、未承認件数 ≥ 1 なら reply の末尾に追記:

```
メッセージありがとうございます ✨ 内容を確認してご連絡します
※管理画面に登録案 3 件あります
```

### push 通知

- **条件**: 同一予約の未承認件数が **3 件に達した時の初回のみ**、オーナーに1回 push
- **重複防止**: 当日中の同予約の push 履歴を `line_messages` 内に `sender='system', message_type='owner_alert'` で保存して照合
- **1日1回上限**: 同予約・同日は2回目以降スキップ

### 純粋関数化

- `lib/notifications/computeReplySuffix.ts`: 未承認件数から reply 追記文字列を返す
- `lib/notifications/shouldPushOwnerAlert.ts`: 件数 + 当日履歴から「push すべきか」を返す

---

## エラー処理（まとめ）

| 場面 | HTTP / 挙動 |
|------|------|
| Anthropic API タイムアウト / 5xx | webhook 200、抽出スキップ、warn ログ |
| AI 抽出 0 件 | 何もしない（reply 通常）|
| 異常値（quantity ≤ 0、items 不在）| 当該 line スキップ、他は通常処理 |
| 承認時 status !== 'pending' | 409 Conflict |
| 承認時 item_id NULL | 400「商品を選択してください」|
| 拒否時 status !== 'pending' | 409 Conflict |
| 在庫マイナス | B-4 既存仕様：マイナス許容 + warn、仕訳通常通り |
| AI Tool レスポンスの itemId が DB に無い | NULL に正規化（draft は残す）|

---

## テスト戦略

### 純粋ロジック（vitest、TDD）

| ファイル | テスト件数 |
|------|------|
| `lib/ai/__tests__/buildPrompt.test.ts`               | 4 |
| `lib/ai/__tests__/parseExtractResponse.test.ts`     | 5 |
| `lib/notifications/__tests__/computeReplySuffix.test.ts` | 3 |
| `lib/admin/__tests__/approveDraft.test.ts`          | 3 |

詳細:
- buildPrompt: items整形 / messages整形 / 空配列 / 改行エスケープ
- parseExtractResponse: 正常パース / items未登録IDのnull化 / quantity≤0スキップ / 空配列 / confidenceクランプ（範囲外→範囲内）
- computeReplySuffix: 0件→なし / 1-2件→末尾追記 / 3件以上→末尾追記＋pushフラグ
- approveDraft: pending→approved遷移 / 状態不正→error / item_id null→error

### 統合系（手動 + 本番疎通）

| 確認項目 | 方法 |
|------|------|
| Webhook で AI 抽出が走る | 滞在中予約から「ビール2本」送信 → sale_drafts 1行 INSERT、reply に末尾追記 |
| 複数商品抽出 | 「ビール2本とジュース1本」→ 2行 INSERT |
| 注文以外は抽出されない | 「天気は？」→ sale_drafts 行追加なし |
| 承認 | 管理画面で承認 → sale_lines INSERT、在庫減、仕訳作成 |
| 拒否 | 拒否 → status='rejected'、sale_lines 変化なし |
| 編集 | 数量を変えて承認 → 編集後の値が sale_lines に反映 |
| 未承認3件で push | 連続送信で3件貯める → オーナーに1回 push |

### 既存テスト総数

203 → B-7b 完了時 **218 件** (+15)

---

## 環境変数

| 名前 | 用途 |
|------|------|
| `ANTHROPIC_API_KEY` | Claude Haiku 4.5 呼び出し（新規） |

既存の LINE 関連 env は B-7a で設定済。

---

## 後続

- 1〜2 週運用してデータが溜まったら、AI プロンプトを実データから改善
- B-6（Stripe）と合わせて、承認 → 自動決済まで繋ぐ
