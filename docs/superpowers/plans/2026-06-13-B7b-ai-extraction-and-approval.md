# サブプロジェクト B-7b：AI 抽出 + sale_drafts + 承認 UI 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** B-7a の `line_messages` を入力に Claude Haiku 4.5 で `sale_lines` 登録案を即時抽出し、`sale_drafts` テーブルに保存。オーナーは管理画面（スマホ最適化）で1件ずつ承認/拒否し、承認時に既存 B-4 ロジックで `sale_lines` 確定＋会計仕訳まで自動連携する。

**Architecture:** 純粋ロジック（buildPrompt / parseExtractResponse / computeReplySuffix / approveDraft）を TDD で固め、Webhook を拡張して同期で AI 抽出。Anthropic SDK の Tools API で JSON 構造化出力強制、4秒タイムアウトでフォールバック。承認 API は既存 `POST /api/admin/reservations/[id]/sale-lines` と同じパターンで sale_lines INSERT + postSaleConsumption + postSaleEntry を呼ぶ。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin), TypeScript, Vitest, `@anthropic-ai/sdk`, TailwindCSS warm-* palette。

**参照スペック:** `docs/superpowers/specs/2026-06-13-B7b-ai-extraction-and-approval-design.md`

---

## 前提知識（実装者向け）

- ブランチ: `feat/b7b-ai-extraction`（スペックコミット済）。
- 既存テスト総数: **203 件**。完了時 **218 件**（+15: buildPrompt 4, parseExtractResponse 5, computeReplySuffix 3, approveDraft 3）。
- マイグレーション連番: 次は **017**。
- 既存 admin API 認証パターン: `createSupabaseServerClient()` + `getUser()`（`app/api/admin/reservations/[id]/sale-lines/route.ts` 参照）。
- 既存 sale_lines INSERT パターン: 同上ファイル POST。INSERT 後 `postSaleConsumption(/lib/inventory/serverConsume)` + `postSaleEntry(/lib/accounting/serverSalePosting)` を best-effort で呼ぶ。
- 既存 items テーブル: `id, name, category, unit, sale_price, cost_price, is_sellable, is_active`。
- 既存 line_messages: `id, reservation_id, line_user_id, line_message_id, sender, message_type, text, raw_event, received_at`。
- 既存 webhook: `app/api/line/webhook/route.ts`（B-7a 完成）。これを拡張する。
- パス: `"C:/Users/biscu/Downloads/bluesky-camp"`、Bash (Git Bash) で実行。
- Pre-existing tsc errors in `types/reservation.test.ts` are unrelated — ignore.

---

### Task 1: マイグレーション 017（sale_drafts テーブル）

**Files:**
- Create: `supabase/migrations/017_sale_drafts.sql`

- [ ] **Step 1: マイグレーション作成**

```sql
-- supabase/migrations/017_sale_drafts.sql
-- B-7b: AI extraction draft table

CREATE TABLE sale_drafts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id          uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  source_line_message_id  uuid NOT NULL REFERENCES line_messages(id) ON DELETE CASCADE,
  item_id                 uuid REFERENCES items(id),
  item_name_raw           text NOT NULL,
  unit_price              integer,
  quantity                numeric NOT NULL CHECK (quantity > 0),
  occurred_at             date NOT NULL,
  confidence              numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status                  text NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  approved_sale_line_id   uuid REFERENCES sale_lines(id) ON DELETE SET NULL,
  rejected_reason         text,
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

- [ ] **Step 2: Supabase 本番に手動適用**

ユーザー（オーナー）に SQL Editor で実行依頼。実装者は「Step 2 は手動です。お願いします」と報告して待つ。

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/017_sale_drafts.sql && git commit -m "feat(b7b): migration for sale_drafts table"
```

---

### Task 2: Anthropic SDK インストール + env

**Files:**
- Modify: `package.json`（`npm install @anthropic-ai/sdk`）
- Modify: `.env.example`

- [ ] **Step 1: SDK インストール**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm install @anthropic-ai/sdk 2>&1 | tail -3
```

- [ ] **Step 2: .env.example に追記**

末尾に追加:

```dotenv
# === B-7b AI extraction ===
ANTHROPIC_API_KEY=sk-ant-placeholder
```

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add package.json package-lock.json .env.example && git commit -m "feat(b7b): install @anthropic-ai/sdk + env var"
```

---

### Task 3: 純粋ロジック `buildPrompt`（TDD 4件）

**Files:**
- Create: `lib/ai/buildPrompt.ts`
- Test: `lib/ai/__tests__/buildPrompt.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/ai/__tests__/buildPrompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../buildPrompt'

const items = [
  { id: 'itm-001', name: 'アサヒスーパードライ', unit_price: 500 },
  { id: 'itm-002', name: 'コーラ',             unit_price: 300 },
]

const messages = [
  { sender: 'customer' as const, text: 'ビール2本ください', received_at: '2026-06-20T14:30:00Z' },
  { sender: 'owner'    as const, text: 'アサヒでよろしいですか？', received_at: '2026-06-20T14:31:00Z' },
  { sender: 'customer' as const, text: 'はい', received_at: '2026-06-20T14:32:00Z' },
]

describe('buildPrompt', () => {
  it('includes the system instructions', () => {
    const { system } = buildPrompt({ items, messages })
    expect(system).toContain('@blueSky')
    expect(system).toContain('注文')
    expect(system).toContain('空配列')
  })

  it('formats items as a bulleted list with id, name, price', () => {
    const { user } = buildPrompt({ items, messages })
    expect(user).toContain('itm-001')
    expect(user).toContain('アサヒスーパードライ')
    expect(user).toContain('500')
    expect(user).toContain('itm-002')
  })

  it('formats messages oldest first with sender prefix', () => {
    const { user } = buildPrompt({ items, messages })
    const idxFirst = user.indexOf('ビール2本')
    const idxLast  = user.indexOf('はい')
    expect(idxFirst).toBeGreaterThan(0)
    expect(idxLast).toBeGreaterThan(idxFirst)
    expect(user).toContain('[customer')
    expect(user).toContain('[owner')
  })

  it('returns empty messages section when no messages', () => {
    const { user } = buildPrompt({ items, messages: [] })
    expect(user).toContain('=== recent messages')
    expect(user).not.toContain('[customer')
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/ai/__tests__/buildPrompt.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/ai/buildPrompt.ts
export interface PromptItem {
  id: string
  name: string
  unit_price: number
}

export interface PromptMessage {
  sender: 'customer' | 'owner'
  text: string
  received_at: string
}

const SYSTEM = `あなたは @blueSky キャンプ場の注文抽出アシスタントです。
お客様とオーナーのLINE会話から、お客様が「注文した商品」だけを抽出してください。
質問・雑談・キャンセル意図は抽出しないこと。
オーナーの確認発言（「生ビール2本ですね？」）にお客様が「はい」と答えた場合は抽出します。
items 一覧から最も近い id を選び、見つからない場合は null。
confidence は 0..1 で確信度を返してください（注文無しなら空配列を返してください）。`

export function buildPrompt(input: { items: PromptItem[]; messages: PromptMessage[] }): { system: string; user: string } {
  const itemsSection = input.items
    .map(i => `- id: ${i.id}, name: ${i.name}, unit_price: ${i.unit_price}`)
    .join('\n')
  const messagesSection = input.messages
    .map(m => `[${m.sender} ${m.received_at}] ${m.text}`)
    .join('\n')
  const user = `=== items ===\n${itemsSection}\n\n=== recent messages (oldest first) ===\n${messagesSection}`
  return { system: SYSTEM, user }
}
```

- [ ] **Step 4: PASS（4/4）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/ai/__tests__/buildPrompt.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/ai/buildPrompt.ts lib/ai/__tests__/buildPrompt.test.ts && git commit -m "feat(b7b): buildPrompt pure logic for AI extraction"
```

---

### Task 4: 純粋ロジック `parseExtractResponse`（TDD 5件）

**Files:**
- Create: `lib/ai/parseExtractResponse.ts`
- Test: `lib/ai/__tests__/parseExtractResponse.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/ai/__tests__/parseExtractResponse.test.ts
import { describe, it, expect } from 'vitest'
import { parseExtractResponse } from '../parseExtractResponse'

const validItemIds = new Set(['itm-001', 'itm-002'])

describe('parseExtractResponse', () => {
  it('parses normal response with all fields', () => {
    const r = parseExtractResponse(
      { lines: [{ itemId: 'itm-001', itemNameRaw: 'ビール', quantity: 2, unitPrice: 500, confidence: 0.95 }] },
      validItemIds,
    )
    expect(r).toEqual([
      { itemId: 'itm-001', itemNameRaw: 'ビール', quantity: 2, unitPrice: 500, confidence: 0.95 },
    ])
  })

  it('nulls out itemId not in valid set', () => {
    const r = parseExtractResponse(
      { lines: [{ itemId: 'itm-999', itemNameRaw: 'X', quantity: 1, unitPrice: null, confidence: 0.5 }] },
      validItemIds,
    )
    expect(r[0].itemId).toBeNull()
  })

  it('skips lines with quantity <= 0', () => {
    const r = parseExtractResponse(
      { lines: [
        { itemId: 'itm-001', itemNameRaw: 'A', quantity: 0,  unitPrice: 500, confidence: 0.9 },
        { itemId: 'itm-002', itemNameRaw: 'B', quantity: -1, unitPrice: 300, confidence: 0.9 },
        { itemId: 'itm-001', itemNameRaw: 'C', quantity: 1,  unitPrice: 500, confidence: 0.9 },
      ]},
      validItemIds,
    )
    expect(r).toHaveLength(1)
    expect(r[0].itemNameRaw).toBe('C')
  })

  it('returns empty array for empty input', () => {
    expect(parseExtractResponse({ lines: [] }, validItemIds)).toEqual([])
  })

  it('clamps confidence outside 0..1', () => {
    const r = parseExtractResponse(
      { lines: [
        { itemId: 'itm-001', itemNameRaw: 'A', quantity: 1, unitPrice: null, confidence: 1.5 },
        { itemId: 'itm-002', itemNameRaw: 'B', quantity: 1, unitPrice: null, confidence: -0.2 },
      ]},
      validItemIds,
    )
    expect(r[0].confidence).toBe(1)
    expect(r[1].confidence).toBe(0)
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/ai/__tests__/parseExtractResponse.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/ai/parseExtractResponse.ts
export interface ExtractedLine {
  itemId: string | null
  itemNameRaw: string
  quantity: number
  unitPrice: number | null
  confidence: number
}

interface RawLine {
  itemId?: string | null
  itemNameRaw?: string
  quantity?: number
  unitPrice?: number | null
  confidence?: number
}

export function parseExtractResponse(
  response: { lines?: RawLine[] },
  validItemIds: Set<string>,
): ExtractedLine[] {
  const out: ExtractedLine[] = []
  for (const l of response.lines ?? []) {
    const quantity = Number(l.quantity ?? 0)
    if (!(quantity > 0)) continue
    const rawConf = Number(l.confidence ?? 0)
    const confidence = Math.max(0, Math.min(1, rawConf))
    const itemId = l.itemId && validItemIds.has(l.itemId) ? l.itemId : null
    out.push({
      itemId,
      itemNameRaw: l.itemNameRaw ?? '',
      quantity,
      unitPrice: l.unitPrice ?? null,
      confidence,
    })
  }
  return out
}
```

- [ ] **Step 4: PASS（5/5）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/ai/__tests__/parseExtractResponse.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/ai/parseExtractResponse.ts lib/ai/__tests__/parseExtractResponse.test.ts && git commit -m "feat(b7b): parseExtractResponse pure logic"
```

---

### Task 5: `extractSaleDrafts`（Anthropic SDK 統合、タイムアウト）

**Files:**
- Create: `lib/ai/extractSaleDrafts.ts`

統合系（手動疎通のみ、ユニットテストなし）。

- [ ] **Step 1: 実装**

```typescript
// lib/ai/extractSaleDrafts.ts
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt, type PromptItem, type PromptMessage } from './buildPrompt'
import { parseExtractResponse, type ExtractedLine } from './parseExtractResponse'

const MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 4000

const TOOL = {
  name: 'extract_sale_drafts',
  description: 'お客様の注文を構造化して返す',
  input_schema: {
    type: 'object' as const,
    required: ['lines'],
    properties: {
      lines: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          required: ['itemId', 'itemNameRaw', 'quantity', 'confidence'],
          properties: {
            itemId:      { type: ['string', 'null'] as const },
            itemNameRaw: { type: 'string' as const },
            quantity:    { type: 'number' as const },
            unitPrice:   { type: ['number', 'null'] as const },
            confidence:  { type: 'number' as const, minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
}

export async function extractSaleDrafts(input: { items: PromptItem[]; messages: PromptMessage[] }): Promise<ExtractedLine[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { console.warn('[extractSaleDrafts] ANTHROPIC_API_KEY not set'); return [] }
  const { system, user } = buildPrompt(input)
  const validItemIds = new Set(input.items.map(i => i.id))
  const client = new Anthropic({ apiKey })
  try {
    const result = await Promise.race([
      client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0,
        system,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: user }],
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
    ])
    const toolUse = result.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return []
    return parseExtractResponse(toolUse.input as { lines?: unknown[] } as never, validItemIds)
  } catch (e) {
    console.warn('[extractSaleDrafts] failed:', e instanceof Error ? e.message : e)
    return []
  }
}
```

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/ai/extractSaleDrafts.ts && git commit -m "feat(b7b): extractSaleDrafts using Anthropic Haiku 4.5 with 4s timeout"
```

---

### Task 6: 通知ロジック `computeReplySuffix` + `shouldPushOwnerAlert`（TDD 3+α件）

**Files:**
- Create: `lib/notifications/computeReplySuffix.ts`
- Create: `lib/notifications/shouldPushOwnerAlert.ts`
- Test: `lib/notifications/__tests__/computeReplySuffix.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/notifications/__tests__/computeReplySuffix.test.ts
import { describe, it, expect } from 'vitest'
import { computeReplySuffix } from '../computeReplySuffix'
import { shouldPushOwnerAlert } from '../shouldPushOwnerAlert'

describe('computeReplySuffix', () => {
  it('returns empty string for 0 pending drafts', () => {
    expect(computeReplySuffix(0)).toBe('')
  })

  it('appends note for 1-2 pending drafts', () => {
    expect(computeReplySuffix(1)).toContain('登録案 1 件')
    expect(computeReplySuffix(2)).toContain('登録案 2 件')
  })

  it('appends note for 3+ pending drafts', () => {
    expect(computeReplySuffix(5)).toContain('登録案 5 件')
  })
})

describe('shouldPushOwnerAlert', () => {
  it('returns true when count just reached 3 and no prior alert today', () => {
    expect(shouldPushOwnerAlert(3, false)).toBe(true)
  })

  it('returns false when count < 3', () => {
    expect(shouldPushOwnerAlert(2, false)).toBe(false)
  })

  it('returns false when already alerted today', () => {
    expect(shouldPushOwnerAlert(3, true)).toBe(false)
    expect(shouldPushOwnerAlert(10, true)).toBe(false)
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/notifications 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/notifications/computeReplySuffix.ts
export function computeReplySuffix(pendingCount: number): string {
  if (pendingCount <= 0) return ''
  return `\n※管理画面に登録案 ${pendingCount} 件あります`
}
```

```typescript
// lib/notifications/shouldPushOwnerAlert.ts
export function shouldPushOwnerAlert(pendingCount: number, alreadyAlertedToday: boolean): boolean {
  if (alreadyAlertedToday) return false
  return pendingCount >= 3
}
```

- [ ] **Step 4: PASS（6/6 計）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/notifications 2>&1 | tail -5
```
Expected: 6 PASS（computeReplySuffix 3 + shouldPushOwnerAlert 3）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/notifications && git commit -m "feat(b7b): computeReplySuffix + shouldPushOwnerAlert pure logic"
```

---

### Task 7: 純粋ロジック `validateApprove`（TDD 3件）

**Files:**
- Create: `lib/admin/validateApprove.ts`
- Test: `lib/admin/__tests__/validateApprove.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/admin/__tests__/validateApprove.test.ts
import { describe, it, expect } from 'vitest'
import { validateApprove } from '../validateApprove'

describe('validateApprove', () => {
  it('returns ok for pending + item_id set', () => {
    expect(validateApprove({ status: 'pending', item_id: 'itm-001' })).toEqual({ ok: true })
  })

  it('returns conflict error for non-pending status', () => {
    expect(validateApprove({ status: 'approved', item_id: 'itm-001' })).toEqual({
      ok: false, httpStatus: 409, message: 'すでに承認/拒否済みです',
    })
  })

  it('returns bad-request when item_id is null', () => {
    expect(validateApprove({ status: 'pending', item_id: null })).toEqual({
      ok: false, httpStatus: 400, message: '商品を選択してください',
    })
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/admin/__tests__/validateApprove.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/admin/validateApprove.ts
export type ValidateApproveResult =
  | { ok: true }
  | { ok: false; httpStatus: 400 | 409; message: string }

export function validateApprove(draft: { status: string; item_id: string | null }): ValidateApproveResult {
  if (draft.status !== 'pending')
    return { ok: false, httpStatus: 409, message: 'すでに承認/拒否済みです' }
  if (!draft.item_id)
    return { ok: false, httpStatus: 400, message: '商品を選択してください' }
  return { ok: true }
}
```

- [ ] **Step 4: PASS（3/3）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/admin/__tests__/validateApprove.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/admin/validateApprove.ts lib/admin/__tests__/validateApprove.test.ts && git commit -m "feat(b7b): validateApprove pure logic for sale_drafts approval"
```

---

### Task 8: Webhook 拡張（AI 抽出 + sale_drafts INSERT + reply suffix + push）

**Files:**
- Modify: `app/api/line/webhook/route.ts`

- [ ] **Step 1: 既存ファイルを Read で確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && cat app/api/line/webhook/route.ts
```

既存構造を把握。`reply()` 関数は既存。

- [ ] **Step 2: webhook を全置換**

```typescript
// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifySignature } from '@/lib/line/verifySignature'
import { classifySender } from '@/lib/line/classifySender'
import { resolveActiveReservation, type ActiveReservationRow } from '@/lib/line/resolveActiveReservation'
import { extractSaleDrafts } from '@/lib/ai/extractSaleDrafts'
import { computeReplySuffix } from '@/lib/notifications/computeReplySuffix'
import { shouldPushOwnerAlert } from '@/lib/notifications/shouldPushOwnerAlert'

export const runtime = 'nodejs'

interface LineEvent {
  type: string
  timestamp: number
  source?: { userId?: string }
  message?: { id: string; type: string; text?: string }
  replyToken?: string
}

const REPLY_TEXT = 'メッセージありがとうございます ✨ 内容を確認してご連絡します'

async function reply(replyToken: string, text: string): Promise<void> {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    })
  } catch (e) {
    console.error('[line/webhook] reply failed', e)
  }
}

async function pushOwnerAlert(text: string): Promise<void> {
  const userId = process.env.LINE_OWNER_USER_ID
  if (!userId) return
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
    })
  } catch (e) {
    console.error('[line/webhook] push failed', e)
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const sig = req.headers.get('x-line-signature') ?? ''
  const secret = process.env.LINE_CHANNEL_SECRET ?? ''
  if (!verifySignature(raw, sig, secret))
    return new NextResponse('Unauthorized', { status: 401 })

  let payload: { events: LineEvent[] }
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ ok: true }) }

  const ownerId = process.env.LINE_OWNER_USER_ID
  const today = new Date().toISOString().slice(0, 10)

  for (const ev of payload.events ?? []) {
    if (ev.type !== 'message' || !ev.source?.userId || !ev.message) continue
    const lineUserId = ev.source.userId
    const sender = classifySender(lineUserId, ownerId)

    const { data: rows } = await supabaseAdmin
      .from('reservations')
      .select('id, checkin_date, checkout_date, created_at')
      .eq('line_user_id', lineUserId)
    const active = resolveActiveReservation(today, (rows ?? []) as ActiveReservationRow[])

    const { data: inserted } = await supabaseAdmin.from('line_messages').upsert({
      reservation_id: active?.id ?? null,
      line_user_id: lineUserId,
      line_message_id: ev.message.id,
      sender,
      message_type: ev.message.type,
      text: ev.message.type === 'text' ? (ev.message.text ?? null) : null,
      raw_event: ev,
      received_at: new Date(ev.timestamp).toISOString(),
    }, { onConflict: 'line_message_id', ignoreDuplicates: false })
      .select('id').maybeSingle()
    const sourceLineMessageId = inserted?.id ?? null

    // === B-7b: AI 抽出 ===
    if (sender === 'customer' && active && sourceLineMessageId && ev.message.type === 'text' && ev.message.text) {
      const [{ data: recentMsgs }, { data: items }] = await Promise.all([
        supabaseAdmin
          .from('line_messages').select('sender, text, received_at, message_type')
          .eq('reservation_id', active.id).eq('message_type', 'text')
          .order('received_at', { ascending: false }).limit(10),
        supabaseAdmin.from('items').select('id, name, sale_price')
          .eq('is_sellable', true).eq('is_active', true),
      ])
      const messagesForAi = (recentMsgs ?? [])
        .filter(m => m.text && (m.sender === 'customer' || m.sender === 'owner'))
        .reverse()
        .map(m => ({ sender: m.sender as 'customer' | 'owner', text: m.text as string, received_at: m.received_at }))
      const itemsForAi = (items ?? [])
        .filter(i => i.sale_price != null)
        .map(i => ({ id: i.id, name: i.name, unit_price: i.sale_price as number }))

      const extracted = await extractSaleDrafts({ items: itemsForAi, messages: messagesForAi })

      if (extracted.length > 0) {
        const occurredAt = today
        const rawExtraction = { messages: messagesForAi.length, items: itemsForAi.length, result: extracted }
        const draftsToInsert = extracted.map(e => ({
          reservation_id: active.id,
          source_line_message_id: sourceLineMessageId,
          item_id: e.itemId,
          item_name_raw: e.itemNameRaw,
          unit_price: e.unitPrice,
          quantity: e.quantity,
          occurred_at: occurredAt,
          confidence: e.confidence,
          raw_extraction: rawExtraction,
        }))
        await supabaseAdmin.from('sale_drafts').insert(draftsToInsert)
      }
    }

    // === reply with suffix + optional push ===
    if (sender === 'customer' && ev.replyToken) {
      let suffix = ''
      let pendingCount = 0
      if (active) {
        const { count } = await supabaseAdmin
          .from('sale_drafts').select('*', { count: 'exact', head: true })
          .eq('reservation_id', active.id).eq('status', 'pending')
        pendingCount = count ?? 0
        suffix = computeReplySuffix(pendingCount)
      }
      await reply(ev.replyToken, REPLY_TEXT + suffix)

      if (active && pendingCount > 0) {
        const { count: alertCount } = await supabaseAdmin
          .from('line_messages').select('*', { count: 'exact', head: true })
          .eq('reservation_id', active.id)
          .eq('sender', 'system').eq('message_type', 'owner_alert')
          .gte('received_at', `${today}T00:00:00Z`)
        const alreadyAlertedToday = (alertCount ?? 0) > 0
        if (shouldPushOwnerAlert(pendingCount, alreadyAlertedToday)) {
          await pushOwnerAlert(`@blueSky: 予約 ${active.id.slice(0, 8).toUpperCase()} の未承認登録案が ${pendingCount} 件あります`)
          await supabaseAdmin.from('line_messages').insert({
            reservation_id: active.id,
            line_user_id: 'system',
            line_message_id: null,
            sender: 'system',
            message_type: 'owner_alert',
            text: `pending=${pendingCount}`,
            raw_event: { type: 'owner_alert' },
            received_at: new Date().toISOString(),
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
```
Expected: 新規エラーなし

- [ ] **Step 4: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/line/webhook/route.ts && git commit -m "feat(b7b): webhook extension - AI extract + sale_drafts insert + reply suffix + push alert"
```

---

### Task 9: 一覧 API `GET /api/admin/sale-drafts`

**Files:**
- Create: `app/api/admin/sale-drafts/route.ts`

- [ ] **Step 1: 実装**

```typescript
// app/api/admin/sale-drafts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reservationId = req.nextUrl.searchParams.get('reservationId')

  let query = supabaseAdmin
    .from('sale_drafts')
    .select(`
      id, reservation_id, item_id, item_name_raw, unit_price, quantity,
      occurred_at, confidence, status, created_at,
      reservations!inner(id, guest_name, checkin_date, checkout_date),
      line_messages!inner(id, text, received_at)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (reservationId) query = query.eq('reservation_id', reservationId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const itemIds = Array.from(new Set((data ?? []).map(d => d.item_id).filter(Boolean))) as string[]
  let itemsMap: Record<string, string> = {}
  if (itemIds.length > 0) {
    const { data: items } = await supabaseAdmin.from('items').select('id, name').in('id', itemIds)
    itemsMap = Object.fromEntries((items ?? []).map(i => [i.id, i.name]))
  }

  const drafts = (data ?? []).map(d => {
    const r = (d as unknown as { reservations: { id: string; guest_name: string; checkin_date: string; checkout_date: string } }).reservations
    const m = (d as unknown as { line_messages: { id: string; text: string | null; received_at: string } }).line_messages
    return {
      id: d.id,
      reservationId: d.reservation_id,
      reservationShortId: r.id.slice(0, 8).toUpperCase(),
      guestName: r.guest_name,
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
      itemId: d.item_id,
      itemName: d.item_id ? (itemsMap[d.item_id] ?? null) : null,
      itemNameRaw: d.item_name_raw,
      unitPrice: d.unit_price,
      quantity: Number(d.quantity),
      occurredAt: d.occurred_at,
      confidence: Number(d.confidence),
      sourceMessageText: m.text,
      sourceMessageReceivedAt: m.received_at,
      createdAt: d.created_at,
    }
  })

  return NextResponse.json({ drafts })
}
```

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/admin/sale-drafts && git commit -m "feat(b7b): GET /api/admin/sale-drafts list endpoint"
```

---

### Task 10: 個別操作 API（PATCH 編集 / approve / reject）

**Files:**
- Create: `app/api/admin/sale-drafts/[id]/route.ts`
- Create: `app/api/admin/sale-drafts/[id]/approve/route.ts`
- Create: `app/api/admin/sale-drafts/[id]/reject/route.ts`

- [ ] **Step 1: PATCH 編集**

```typescript
// app/api/admin/sale-drafts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { itemId?: string | null; unitPrice?: number | null; quantity?: number; occurredAt?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.itemId !== undefined)     update.item_id = body.itemId
  if (body.unitPrice !== undefined)  update.unit_price = body.unitPrice
  if (body.quantity !== undefined) {
    if (!(body.quantity > 0)) return NextResponse.json({ error: 'quantity > 0 が必要です' }, { status: 400 })
    update.quantity = body.quantity
  }
  if (body.occurredAt !== undefined) update.occurred_at = body.occurredAt

  const { data, error } = await supabaseAdmin
    .from('sale_drafts').update(update).eq('id', params.id).eq('status', 'pending')
    .select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'pending な抽出案が見つかりません' }, { status: 404 })
  return NextResponse.json({ draft: data })
}
```

- [ ] **Step 2: approve**

```typescript
// app/api/admin/sale-drafts/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateApprove } from '@/lib/admin/validateApprove'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: draft } = await supabaseAdmin
    .from('sale_drafts').select('*').eq('id', params.id).maybeSingle()
  if (!draft) return NextResponse.json({ error: '抽出案が見つかりません' }, { status: 404 })

  const validation = validateApprove({ status: draft.status, item_id: draft.item_id })
  if (!validation.ok) return NextResponse.json({ error: validation.message }, { status: validation.httpStatus })

  const { data: item } = await supabaseAdmin
    .from('items').select('id, name, sale_price, is_sellable, is_active').eq('id', draft.item_id).maybeSingle()
  if (!item)                     return NextResponse.json({ error: '品目が見つかりません' }, { status: 404 })
  if (item.is_sellable !== true) return NextResponse.json({ error: '販売不可の品目です' }, { status: 400 })
  const unitPrice = draft.unit_price ?? item.sale_price
  if (unitPrice == null)         return NextResponse.json({ error: '単価が未設定です' }, { status: 400 })

  const { data: line, error: insErr } = await supabaseAdmin.from('sale_lines').insert({
    reservation_id: draft.reservation_id,
    item_id: draft.item_id,
    item_name: item.name,
    unit_price: unitPrice,
    quantity: Number(draft.quantity),
    occurred_at: draft.occurred_at,
    note: `AI抽出: ${draft.item_name_raw}`,
  }).select().single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  await supabaseAdmin.from('sale_drafts').update({
    status: 'approved', approved_sale_line_id: line.id, updated_at: new Date().toISOString(),
  }).eq('id', params.id)

  // B-4 連携（best-effort）
  try {
    const { postSaleConsumption } = await import('@/lib/inventory/serverConsume')
    await postSaleConsumption({
      id: line.id, item_id: line.item_id,
      quantity: Number(line.quantity), occurred_at: line.occurred_at,
    })
  } catch (e) { console.error('postSaleConsumption failed:', e) }
  try {
    const { postSaleEntry } = await import('@/lib/accounting/serverSalePosting')
    await postSaleEntry({
      id: line.id, item_name: line.item_name,
      unit_price: line.unit_price, quantity: Number(line.quantity),
      occurred_at: line.occurred_at,
    })
  } catch (e) { console.error('postSaleEntry failed:', e) }

  return NextResponse.json({ saleLineId: line.id }, { status: 200 })
}
```

- [ ] **Step 3: reject**

```typescript
// app/api/admin/sale-drafts/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reason?: string } = {}
  try { body = await req.json() } catch { /* body 任意 */ }

  const { data, error } = await supabaseAdmin
    .from('sale_drafts').update({
      status: 'rejected', rejected_reason: body.reason ?? null, updated_at: new Date().toISOString(),
    })
    .eq('id', params.id).eq('status', 'pending')
    .select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'pending な抽出案が見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/admin/sale-drafts && git commit -m "feat(b7b): PATCH edit + POST approve/reject endpoints"
```

---

### Task 11: 一覧ページ `/admin/sale-drafts` + DraftCard

**Files:**
- Create: `app/admin/(dashboard)/sale-drafts/page.tsx`
- Create: `app/admin/(dashboard)/sale-drafts/DraftCard.tsx`

- [ ] **Step 1: 既存 admin レイアウトを確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && ls "app/admin/(dashboard)/" 2>&1 | head -10
```

- [ ] **Step 2: page.tsx 作成**

```tsx
// app/admin/(dashboard)/sale-drafts/page.tsx
import DraftCard from './DraftCard'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface DraftRow {
  id: string
  reservationId: string
  reservationShortId: string
  guestName: string
  checkinDate: string
  checkoutDate: string
  itemId: string | null
  itemName: string | null
  itemNameRaw: string
  unitPrice: number | null
  quantity: number
  occurredAt: string
  confidence: number
  sourceMessageText: string | null
  sourceMessageReceivedAt: string
  createdAt: string
}

async function fetchDrafts(): Promise<DraftRow[]> {
  const { data } = await supabaseAdmin
    .from('sale_drafts')
    .select(`
      id, reservation_id, item_id, item_name_raw, unit_price, quantity,
      occurred_at, confidence, status, created_at,
      reservations!inner(id, guest_name, checkin_date, checkout_date),
      line_messages!inner(id, text, received_at)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  const itemIds = Array.from(new Set((data ?? []).map(d => d.item_id).filter(Boolean))) as string[]
  let itemsMap: Record<string, string> = {}
  if (itemIds.length > 0) {
    const { data: items } = await supabaseAdmin.from('items').select('id, name').in('id', itemIds)
    itemsMap = Object.fromEntries((items ?? []).map(i => [i.id, i.name]))
  }
  return (data ?? []).map((d: Record<string, unknown>): DraftRow => {
    const r = d.reservations as { id: string; guest_name: string; checkin_date: string; checkout_date: string }
    const m = d.line_messages as { id: string; text: string | null; received_at: string }
    return {
      id: d.id as string,
      reservationId: d.reservation_id as string,
      reservationShortId: r.id.slice(0, 8).toUpperCase(),
      guestName: r.guest_name,
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
      itemId: (d.item_id as string | null) ?? null,
      itemName: d.item_id ? (itemsMap[d.item_id as string] ?? null) : null,
      itemNameRaw: d.item_name_raw as string,
      unitPrice: (d.unit_price as number | null) ?? null,
      quantity: Number(d.quantity),
      occurredAt: d.occurred_at as string,
      confidence: Number(d.confidence),
      sourceMessageText: m.text,
      sourceMessageReceivedAt: m.received_at,
      createdAt: d.created_at as string,
    }
  })
}

async function fetchItems() {
  const { data } = await supabaseAdmin
    .from('items').select('id, name, sale_price')
    .eq('is_sellable', true).eq('is_active', true).order('name')
  return (data ?? []) as { id: string; name: string; sale_price: number | null }[]
}

export default async function SaleDraftsPage() {
  const [drafts, items] = await Promise.all([fetchDrafts(), fetchItems()])
  return (
    <main className="min-h-screen bg-warm-50 p-4">
      <div className="max-w-md mx-auto space-y-3">
        <h1 className="text-warm-700 font-serif text-2xl">📋 未承認の抽出案</h1>
        <p className="text-warm-400 text-xs">{drafts.length} 件</p>
        {drafts.length === 0 ? (
          <p className="text-warm-400 text-sm py-10 text-center">未承認の抽出案はありません</p>
        ) : (
          drafts.map(d => <DraftCard key={d.id} draft={d} items={items} />)
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: DraftCard.tsx 作成**

```tsx
// app/admin/(dashboard)/sale-drafts/DraftCard.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Draft {
  id: string
  reservationShortId: string
  guestName: string
  checkinDate: string
  checkoutDate: string
  itemId: string | null
  itemName: string | null
  itemNameRaw: string
  unitPrice: number | null
  quantity: number
  occurredAt: string
  confidence: number
  sourceMessageText: string | null
  sourceMessageReceivedAt: string
}

interface Item {
  id: string
  name: string
  sale_price: number | null
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.7 ? 'bg-green-100 text-green-700' : value >= 0.4 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs px-2 py-0.5 rounded ${color}`}>信頼度 {pct}%</span>
}

export default function DraftCard({ draft, items }: { draft: Draft; items: Item[] }) {
  const router = useRouter()
  const [itemId, setItemId]       = useState<string | ''>(draft.itemId ?? '')
  const [quantity, setQuantity]   = useState(String(draft.quantity))
  const [unitPrice, setUnitPrice] = useState(String(draft.unitPrice ?? items.find(i => i.id === draft.itemId)?.sale_price ?? ''))
  const [occurredAt, setOccurredAt] = useState(draft.occurredAt)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  const persist = async () => {
    await fetch(`/api/admin/sale-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: itemId || null,
        quantity: Number(quantity),
        unitPrice: unitPrice ? Number(unitPrice) : null,
        occurredAt,
      }),
    })
  }

  const approve = async () => {
    setBusy(true); setErr(null)
    await persist()
    const res = await fetch(`/api/admin/sale-drafts/${draft.id}/approve`, { method: 'POST' })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? '承認に失敗しました'); setBusy(false); return }
    router.refresh()
  }

  const reject = async () => {
    const reason = window.prompt('拒否理由（任意）') ?? ''
    setBusy(true); setErr(null)
    const res = await fetch(`/api/admin/sale-drafts/${draft.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? '拒否に失敗しました'); setBusy(false); return }
    router.refresh()
  }

  const itemMissing = !itemId
  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-warm-400 text-xs">🏕 {draft.reservationShortId} {draft.guestName} 様</p>
        <p className="text-warm-500 text-xs">{draft.checkinDate} 〜 {draft.checkoutDate}</p>
      </div>
      <div className="flex items-center justify-between">
        <p className="font-bold text-warm-700">🛒 {draft.itemName ?? draft.itemNameRaw} × {draft.quantity}</p>
        <ConfidenceBadge value={draft.confidence} />
      </div>
      <p className="text-xs text-warm-500 bg-warm-50 rounded p-2">💬「{draft.sourceMessageText}」<br /><span className="text-warm-300">{draft.sourceMessageReceivedAt}</span></p>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="col-span-2">
          <span className="text-warm-400 text-xs">商品</span>
          <select value={itemId} onChange={e => setItemId(e.target.value)}
            className={`w-full border rounded px-2 py-2 ${itemMissing ? 'border-orange-400 bg-orange-50' : 'border-warm-200'}`}>
            <option value="">（未選択）</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label>
          <span className="text-warm-400 text-xs">数量</span>
          <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)}
            className="w-full border border-warm-200 rounded px-2 py-2" />
        </label>
        <label>
          <span className="text-warm-400 text-xs">単価</span>
          <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
            className="w-full border border-warm-200 rounded px-2 py-2" />
        </label>
        <label className="col-span-2">
          <span className="text-warm-400 text-xs">日付</span>
          <input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)}
            className="w-full border border-warm-200 rounded px-2 py-2" />
        </label>
      </div>

      {err && <p className="text-red-500 text-sm">{err}</p>}
      <div className="flex gap-2">
        <button onClick={approve} disabled={busy || itemMissing}
          className="flex-1 bg-warm-500 hover:bg-warm-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg">
          ✅ 承認
        </button>
        <button onClick={reject} disabled={busy}
          className="flex-1 bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold py-2 rounded-lg">
          ❌ 拒否
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/admin/(dashboard)/sale-drafts" && git commit -m "feat(b7b): /admin/sale-drafts list page + DraftCard"
```

---

### Task 12: 予約詳細ページに「未承認の抽出案」セクション追加

**Files:**
- Modify: `app/admin/(dashboard)/reservations/[id]/page.tsx`

- [ ] **Step 1: 既存ファイルを Read で確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && head -50 "app/admin/(dashboard)/reservations/[id]/page.tsx"
```
販売履歴セクションがある位置を特定。

- [ ] **Step 2: セクション追加**

販売履歴セクションの **直下** に、以下を挿入。先頭に必要なら import を追加:

```tsx
import DraftCard from '../../sale-drafts/DraftCard'
```

挿入する JSX（既存ページのデータ取得関数で `reservation.id` が使える前提）:

```tsx
{/* B-7b: 未承認の抽出案 */}
{(async () => {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { data: drafts } = await supabaseAdmin
    .from('sale_drafts')
    .select(`id, reservation_id, item_id, item_name_raw, unit_price, quantity,
             occurred_at, confidence, status, created_at,
             reservations!inner(id, guest_name, checkin_date, checkout_date),
             line_messages!inner(id, text, received_at)`)
    .eq('reservation_id', reservation.id).eq('status', 'pending')
    .order('created_at', { ascending: false })
  const itemIds = Array.from(new Set((drafts ?? []).map(d => d.item_id).filter(Boolean))) as string[]
  const { data: itemsForMap } = itemIds.length > 0
    ? await supabaseAdmin.from('items').select('id, name').in('id', itemIds)
    : { data: [] }
  const itemsMap = Object.fromEntries((itemsForMap ?? []).map(i => [i.id, i.name]))
  const { data: items } = await supabaseAdmin
    .from('items').select('id, name, sale_price')
    .eq('is_sellable', true).eq('is_active', true).order('name')
  const cards = (drafts ?? []).map((d: Record<string, unknown>) => {
    const r = d.reservations as { id: string; guest_name: string; checkin_date: string; checkout_date: string }
    const m = d.line_messages as { id: string; text: string | null; received_at: string }
    return {
      id: d.id as string,
      reservationShortId: r.id.slice(0, 8).toUpperCase(),
      guestName: r.guest_name,
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
      itemId: (d.item_id as string | null) ?? null,
      itemName: d.item_id ? (itemsMap[d.item_id as string] ?? null) : null,
      itemNameRaw: d.item_name_raw as string,
      unitPrice: (d.unit_price as number | null) ?? null,
      quantity: Number(d.quantity),
      occurredAt: d.occurred_at as string,
      confidence: Number(d.confidence),
      sourceMessageText: m.text,
      sourceMessageReceivedAt: m.received_at,
    }
  })
  if (cards.length === 0) return null
  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-warm-700 font-bold">📋 未承認の抽出案 ({cards.length}件)</h2>
      {cards.map(c => <DraftCard key={c.id} draft={c} items={(items ?? []) as { id: string; name: string; sale_price: number | null }[]} />)}
    </section>
  )
})()}
```

**注意**: Next.js 14 でこの IIFE パターンが煩雑な場合、別の `DraftsSection.tsx` server component に切り出して `<DraftsSection reservationId={reservation.id} />` で呼ぶ形でも OK。既存ページの構造に合わせて判断。

- [ ] **Step 3: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/admin/(dashboard)/reservations/[id]/page.tsx" && git commit -m "feat(b7b): add sale_drafts section to reservation detail page"
```

---

### Task 13: ダッシュボードに未承認件数バッジ

**Files:**
- Modify: `app/admin/(dashboard)/page.tsx`（既存 admin ダッシュボード）

- [ ] **Step 1: 既存ファイルを Read で確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && head -60 "app/admin/(dashboard)/page.tsx"
```
既存カード並びの構造を把握。

- [ ] **Step 2: バッジ付きリンクカード追加**

既存のカード一覧の **先頭または上部** に挿入:

```tsx
{/* B-7b: 未承認抽出案バッジ */}
{await (async () => {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { count } = await supabaseAdmin
    .from('sale_drafts').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  const pending = count ?? 0
  return (
    <Link href="/admin/sale-drafts"
      className={`block rounded-2xl p-4 ${pending > 0 ? 'bg-warm-500 text-white' : 'bg-white border border-warm-100 text-warm-700'}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold">📋 未承認の抽出案</span>
        <span className={`font-bold ${pending > 0 ? 'bg-white text-warm-700' : 'bg-warm-100 text-warm-500'} rounded-full px-3 py-0.5 text-sm`}>
          {pending}
        </span>
      </div>
    </Link>
  )
})()}
```

import に `import Link from 'next/link'` 追加（無ければ）。

- [ ] **Step 3: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/admin/(dashboard)/page.tsx" && git commit -m "feat(b7b): add pending sale_drafts badge to admin dashboard"
```

---

### Task 14: 全テスト・ビルド・デプロイ・手動疎通

**Files:** なし（インフラ作業）

- [ ] **Step 1: 全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
```
Expected: **218 PASS**（203 既存 + 15 新規）

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし

- [ ] **Step 3: 本番ビルド**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | grep -E "/admin/sale-drafts|/api/admin/sale-drafts"
```
Expected:
```
├ ƒ /admin/sale-drafts
├ ƒ /api/admin/sale-drafts
├ ƒ /api/admin/sale-drafts/[id]
├ ƒ /api/admin/sale-drafts/[id]/approve
├ ƒ /api/admin/sale-drafts/[id]/reject
```

- [ ] **Step 4: ANTHROPIC_API_KEY を Vercel に設定（オペレーター作業）**

ユーザーに Vercel ダッシュボードで `ANTHROPIC_API_KEY` を Production + Preview に設定するよう依頼。値は Anthropic Console (https://console.anthropic.com/) で発行した API キー。

- [ ] **Step 5: main merge + push + デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git checkout main && git merge --ff-only feat/b7b-ai-extraction && git push origin main 2>&1 | tail -3
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vercel --prod 2>&1 | tail -4
```

- [ ] **Step 6: 手動疎通**

ユーザーに以下の確認を依頼:

1. 滞在中のテスト予約から「ビール2本ください」と LINE 送信 → reply に「※管理画面に登録案 N 件あります」が含まれる
2. Supabase で `SELECT * FROM sale_drafts WHERE status='pending' ORDER BY created_at DESC LIMIT 5;` 実行 → 行が追加されている
3. `/admin/sale-drafts` を開く → DraftCard が表示される、信頼度バッジが色付き
4. 1件「承認」 → sale_lines に行が増え、sale_drafts.status='approved'、在庫減・仕訳エントリも作成（`/admin/accounting/journal` で確認）
5. 別の1件「拒否」 → sale_drafts.status='rejected'、sale_lines 変化なし
6. ダッシュボードに未承認件数バッジが正しく表示
7. 予約詳細ページに「未承認の抽出案」セクションが表示

---

## 完了基準

- 全 218 テスト pass
- 本番ビルド成功、新規 5 ルート登録
- Vercel デプロイ Ready、`ANTHROPIC_API_KEY` 設定済
- 手動疎通 7 項目すべて成功
- ブランチ `feat/b7b-ai-extraction` を main に merge 済

完了後は実運用データを 1〜2 週蓄積し、AI プロンプトを改善するフェーズへ。B-6（Stripe）と統合すれば承認 → 自動決済まで繋がる。
