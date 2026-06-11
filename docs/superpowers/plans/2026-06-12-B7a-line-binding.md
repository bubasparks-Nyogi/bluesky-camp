# サブプロジェクト B-7a：LINE 連携基盤（紐付け + 会話保存）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** お客様の LINE と予約を LIFF で紐付け、公式 LINE への発言を Webhook で受信して `line_messages` テーブルに保存する基盤を作る。AI 抽出は B-7b で別途実装。

**Architecture:** 純粋ロジック（署名検証、sender 判定、滞在中予約解決）を TDD で固め、薄い API ルートと LIFF クライアントから呼ぶ。Webhook の冪等性は LINE event の `message.id` を UNIQUE 制約で担保。

**Tech Stack:** Next.js 14 App Router, Supabase（supabaseAdmin）, TypeScript, Vitest, `@line/liff`, Node 標準 `crypto`（署名検証）。

**参照スペック:** `docs/superpowers/specs/2026-06-12-B7a-line-binding-and-message-storage-design.md`

---

## 前提知識（実装者向け）

- 既存: `reservations` テーブル（id, guest_name, guest_email, checkin_date, checkout_date, user_id, ...）、`supabase/migrations/015_*.sql` まで連番、次は 016。
- `lib/supabase.ts` の `supabaseAdmin`（service role）を使う。
- 既存 `lib/notifications.ts` に `lineReply(userId, text)` あり（LINE Push API、`LINE_CHANNEL_ACCESS_TOKEN` env 使用）。
- 既存テスト総数 189。完了時 203 件想定（+14: verifySignature 6, resolveActiveReservation 5, classifySender 3）。
- シェル: Bash（Git Bash）。パスは `"C:/Users/biscu/Downloads/bluesky-camp"`。
- 既存予約完了/照会ページ: `app/reserve/lookup/[id]/page.tsx`。確認メール: `emails/ReservationConfirm.tsx`。
- ブランチ: `feat/b7a-line-binding`（スペックコミット済）。
- Pre-existing tsc errors in `types/reservation.test.ts` are unrelated — ignore.
- TailwindCSS warm-* パレット（warm-50〜warm-700）使用。

---

### Task 1: マイグレーション `016_line_integration.sql`

**Files:**
- Create: `supabase/migrations/016_line_integration.sql`

- [ ] **Step 1: マイグレーションファイル作成**

```sql
-- supabase/migrations/016_line_integration.sql
-- B-7a: LINE binding + message storage

ALTER TABLE reservations ADD COLUMN line_user_id text;
CREATE INDEX idx_reservations_line_user_id ON reservations(line_user_id)
  WHERE line_user_id IS NOT NULL;

CREATE TABLE line_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE SET NULL,
  line_user_id    text NOT NULL,
  line_message_id text UNIQUE,
  sender          text NOT NULL CHECK (sender IN ('customer','owner','system')),
  message_type    text NOT NULL,
  text            text,
  raw_event       jsonb NOT NULL,
  received_at     timestamptz NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_line_messages_reservation ON line_messages(reservation_id, received_at DESC);
CREATE INDEX idx_line_messages_user        ON line_messages(line_user_id,    received_at DESC);
ALTER TABLE line_messages ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Supabase 本番に適用（手動）**

ユーザー（オーナー）が Supabase ダッシュボード SQL Editor で `016_line_integration.sql` の内容をペーストして実行。実装者は「Step 2 は手動です。お願いします」と報告して待つ。

- [ ] **Step 3: 適用確認＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/016_line_integration.sql && git commit -m "feat(b7a): migration for LINE binding + message storage"
```

---

### Task 2: 純粋ロジック `verifySignature`（TDD 6 件）

**Files:**
- Create: `lib/line/verifySignature.ts`
- Test: `lib/line/__tests__/verifySignature.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/line/__tests__/verifySignature.test.ts
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { verifySignature } from '../verifySignature'

const SECRET = 'test-channel-secret'
const BODY = JSON.stringify({ events: [{ type: 'message' }] })

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64')
}

describe('verifySignature', () => {
  it('returns true for a valid signature', () => {
    const sig = sign(BODY, SECRET)
    expect(verifySignature(BODY, sig, SECRET)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const sig = sign(BODY, SECRET)
    const tampered = BODY + ' '
    expect(verifySignature(tampered, sig, SECRET)).toBe(false)
  })

  it('returns false for a signature from a different secret', () => {
    const sig = sign(BODY, 'other-secret')
    expect(verifySignature(BODY, sig, SECRET)).toBe(false)
  })

  it('returns false for an empty signature header', () => {
    expect(verifySignature(BODY, '', SECRET)).toBe(false)
  })

  it('returns false for an empty body', () => {
    const sig = sign('', SECRET)
    expect(verifySignature('', sig, SECRET)).toBe(true)
    expect(verifySignature(BODY, sig, SECRET)).toBe(false)
  })

  it('uses constant-time comparison (does not throw on length mismatch)', () => {
    expect(() => verifySignature(BODY, 'abc', SECRET)).not.toThrow()
    expect(verifySignature(BODY, 'abc', SECRET)).toBe(false)
  })
})
```

- [ ] **Step 2: 実行して FAIL を確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/line/__tests__/verifySignature.test.ts 2>&1 | tail -5
```
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

```typescript
// lib/line/verifySignature.ts
import crypto from 'crypto'

export function verifySignature(rawBody: string, signature: string, channelSecret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
```

- [ ] **Step 4: 実行して PASS（6/6）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/line/__tests__/verifySignature.test.ts 2>&1 | tail -5
```
Expected: 6 PASS

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/line/verifySignature.ts lib/line/__tests__/verifySignature.test.ts && git commit -m "feat(b7a): verifySignature pure logic for LINE webhook"
```

---

### Task 3: 純粋ロジック `classifySender`（TDD 3 件）

**Files:**
- Create: `lib/line/classifySender.ts`
- Test: `lib/line/__tests__/classifySender.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/line/__tests__/classifySender.test.ts
import { describe, it, expect, vi } from 'vitest'
import { classifySender } from '../classifySender'

describe('classifySender', () => {
  it('returns "owner" when lineUserId matches ownerLineUserId', () => {
    expect(classifySender('U_OWNER', 'U_OWNER')).toBe('owner')
  })

  it('returns "customer" when lineUserId does not match', () => {
    expect(classifySender('U_CUSTOMER', 'U_OWNER')).toBe('customer')
  })

  it('returns "customer" and warns when ownerLineUserId is undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(classifySender('U_ANY', undefined)).toBe('customer')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/line/__tests__/classifySender.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/line/classifySender.ts
export function classifySender(lineUserId: string, ownerLineUserId: string | undefined): 'customer' | 'owner' {
  if (!ownerLineUserId) {
    console.warn('[classifySender] LINE_OWNER_USER_ID not set; treating all as customer')
    return 'customer'
  }
  return lineUserId === ownerLineUserId ? 'owner' : 'customer'
}
```

- [ ] **Step 4: PASS（3/3）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/line/__tests__/classifySender.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/line/classifySender.ts lib/line/__tests__/classifySender.test.ts && git commit -m "feat(b7a): classifySender pure logic"
```

---

### Task 4: 純粋ロジック `resolveActiveReservation`（TDD 5 件）

**Files:**
- Create: `lib/line/resolveActiveReservation.ts`
- Test: `lib/line/__tests__/resolveActiveReservation.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/line/__tests__/resolveActiveReservation.test.ts
import { describe, it, expect } from 'vitest'
import { resolveActiveReservation, type ActiveReservationRow } from '../resolveActiveReservation'

const rows: ActiveReservationRow[] = [
  { id: 'r1', checkin_date: '2026-06-10', checkout_date: '2026-06-12', created_at: '2026-05-01T00:00:00Z' },
  { id: 'r2', checkin_date: '2026-06-15', checkout_date: '2026-06-17', created_at: '2026-05-15T00:00:00Z' },
  { id: 'r3', checkin_date: '2026-07-01', checkout_date: '2026-07-03', created_at: '2026-06-01T00:00:00Z' },
]

describe('resolveActiveReservation', () => {
  it('returns the active reservation when today is within checkin..checkout', () => {
    expect(resolveActiveReservation('2026-06-11', rows)?.id).toBe('r1')
  })

  it('returns reservation on checkin day (inclusive)', () => {
    expect(resolveActiveReservation('2026-06-15', rows)?.id).toBe('r2')
  })

  it('returns reservation on checkout day (inclusive)', () => {
    expect(resolveActiveReservation('2026-06-17', rows)?.id).toBe('r2')
  })

  it('returns null when today is before all checkins', () => {
    expect(resolveActiveReservation('2026-06-09', rows)).toBeNull()
  })

  it('returns latest created_at if multiple match (overlap)', () => {
    const overlapping: ActiveReservationRow[] = [
      { id: 'old', checkin_date: '2026-06-10', checkout_date: '2026-06-20', created_at: '2026-05-01T00:00:00Z' },
      { id: 'new', checkin_date: '2026-06-15', checkout_date: '2026-06-18', created_at: '2026-06-01T00:00:00Z' },
    ]
    expect(resolveActiveReservation('2026-06-16', overlapping)?.id).toBe('new')
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/line/__tests__/resolveActiveReservation.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/line/resolveActiveReservation.ts
export interface ActiveReservationRow {
  id: string
  checkin_date: string   // YYYY-MM-DD
  checkout_date: string  // YYYY-MM-DD
  created_at: string     // ISO 8601
}

export function resolveActiveReservation(
  today: string,
  rows: ActiveReservationRow[],
): ActiveReservationRow | null {
  const matches = rows.filter(r => r.checkin_date <= today && today <= r.checkout_date)
  if (matches.length === 0) return null
  matches.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return matches[0]
}
```

- [ ] **Step 4: PASS（5/5）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/line/__tests__/resolveActiveReservation.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/line/resolveActiveReservation.ts lib/line/__tests__/resolveActiveReservation.test.ts && git commit -m "feat(b7a): resolveActiveReservation pure logic"
```

---

### Task 5: `verifyIdToken`（LINE Verify API ラッパー）

**Files:**
- Create: `lib/line/verifyIdToken.ts`

純粋関数ではなく HTTP 呼び出しを行うため統合系。手動疎通確認のみ（ユニットテストなし）。

- [ ] **Step 1: 実装**

```typescript
// lib/line/verifyIdToken.ts
// LINE LIFF idToken を Verify API で検証し、sub（line_user_id）を返す。
// 失敗時は null。
export async function verifyIdToken(idToken: string, channelId: string): Promise<string | null> {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })
  if (!res.ok) return null
  const json = await res.json() as { sub?: string }
  return json.sub ?? null
}
```

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/line/verifyIdToken.ts && git commit -m "feat(b7a): verifyIdToken LINE Verify API wrapper"
```

---

### Task 6: API `POST /api/line/bind`

**Files:**
- Create: `app/api/line/bind/route.ts`

- [ ] **Step 1: 実装**

```typescript
// app/api/line/bind/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyIdToken } from '@/lib/line/verifyIdToken'

export async function POST(req: NextRequest) {
  let body: { reservationId?: string; lineUserId?: string; idToken?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { reservationId, lineUserId, idToken } = body
  if (!reservationId || !lineUserId || !idToken)
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId)
    return NextResponse.json({ error: 'サーバ設定不備（CHANNEL_ID 未設定）' }, { status: 500 })

  const sub = await verifyIdToken(idToken, channelId)
  if (!sub || sub !== lineUserId)
    return NextResponse.json({ error: 'idToken 検証に失敗しました' }, { status: 401 })

  const { data: r } = await supabaseAdmin
    .from('reservations').select('id, checkin_date').eq('id', reservationId).maybeSingle()
  if (!r) return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const thirty = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  if (r.checkin_date < thirty)
    return NextResponse.json({ error: '古い予約のため連携できません' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('reservations').update({ line_user_id: lineUserId }).eq('id', reservationId)
  if (error) return NextResponse.json({ error: 'DB エラー' }, { status: 500 })

  return NextResponse.json({ ok: true, today })
}
```

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/line/bind && git commit -m "feat(b7a): POST /api/line/bind endpoint"
```

---

### Task 7: API `POST /api/line/webhook`

**Files:**
- Create: `app/api/line/webhook/route.ts`

- [ ] **Step 1: 実装**

```typescript
// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifySignature } from '@/lib/line/verifySignature'
import { classifySender } from '@/lib/line/classifySender'
import { resolveActiveReservation, type ActiveReservationRow } from '@/lib/line/resolveActiveReservation'

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

    await supabaseAdmin.from('line_messages').upsert({
      reservation_id: active?.id ?? null,
      line_user_id: lineUserId,
      line_message_id: ev.message.id,
      sender,
      message_type: ev.message.type,
      text: ev.message.type === 'text' ? (ev.message.text ?? null) : null,
      raw_event: ev,
      received_at: new Date(ev.timestamp).toISOString(),
    }, { onConflict: 'line_message_id', ignoreDuplicates: true })

    if (sender === 'customer' && ev.replyToken)
      await reply(ev.replyToken, REPLY_TEXT)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/line/webhook && git commit -m "feat(b7a): POST /api/line/webhook endpoint"
```

---

### Task 8: LIFF クライアントページ `/line/bind`

**Files:**
- Modify: `package.json`（`npm install @line/liff`）
- Create: `app/line/bind/page.tsx`

- [ ] **Step 1: @line/liff をインストール**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm install @line/liff 2>&1 | tail -3
```

- [ ] **Step 2: LIFF ページ実装**

```tsx
// app/line/bind/page.tsx
'use client'
import { useEffect, useState } from 'react'

type Status = 'loading' | 'success' | 'error'

export default function LineBindPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('LINE連携の設定中...')
  const [liffInstance, setLiffInstance] = useState<typeof import('@line/liff').default | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) throw new Error('LIFF_ID が未設定です')
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId })
        if (cancelled) return
        if (!liff.isLoggedIn()) { liff.login(); return }
        const params = new URLSearchParams(window.location.search)
        const reservationId = params.get('reservationId') ?? params.get('liff.state')?.split('reservationId=')[1] ?? ''
        if (!reservationId) throw new Error('予約番号が見つかりません')
        const profile = await liff.getProfile()
        const idToken = liff.getIDToken()
        if (!idToken) throw new Error('idToken 取得失敗')
        const res = await fetch('/api/line/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId, lineUserId: profile.userId, idToken }),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) throw new Error(json.error ?? '連携に失敗しました')
        if (cancelled) return
        setLiffInstance(liff as unknown as typeof import('@line/liff').default)
        setStatus('success')
        setMessage('連携完了！')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setMessage(e instanceof Error ? e.message : '不明なエラー')
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="min-h-screen bg-warm-50 px-4 py-12">
      <div className="max-w-md mx-auto bg-white border border-warm-100 rounded-2xl p-8 text-center space-y-4">
        <h1 className="font-serif text-2xl text-warm-700">@blueSky</h1>
        {status === 'loading' && (
          <>
            <p className="text-warm-500 text-sm">{message}</p>
            <p className="text-3xl">⏳</p>
          </>
        )}
        {status === 'success' && (
          <>
            <p className="text-warm-700 text-lg">✅ {message}</p>
            <p className="text-warm-500 text-sm">これでLINEから直接ご連絡いただけます。当日の追加注文・質問もこちらへどうぞ。</p>
            <button
              onClick={() => liffInstance?.closeWindow()}
              className="inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-5 py-2 rounded-lg"
            >
              LINEに戻る
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-500 text-lg">⚠️ 連携できませんでした</p>
            <p className="text-warm-500 text-sm">{message}</p>
            <p className="text-warm-400 text-xs">オーナーまでご連絡ください。</p>
          </>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし

- [ ] **Step 4: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add package.json package-lock.json app/line/bind && git commit -m "feat(b7a): LIFF /line/bind page"
```

---

### Task 9: 予約照会ページに LINE 連携ボタン追加

**Files:**
- Modify: `app/reserve/lookup/[id]/page.tsx`

- [ ] **Step 1: 既存ファイルを Read で確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && head -80 app/reserve/lookup/[id]/page.tsx
```
予約番号や日程が表示されている箇所を特定する。

- [ ] **Step 2: LIFF ボタンを追加**

既存表示の **予約番号と日程の直下** に以下のブロックを挿入する（適切な親要素内、import 追加不要）:

```tsx
{process.env.NEXT_PUBLIC_LIFF_ID && (
  <a
    href={`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?reservationId=${reservation.id}`}
    target="_blank" rel="noopener noreferrer"
    className="mt-6 block bg-[#06C755] hover:bg-[#05a847] text-white text-center font-bold py-3 px-4 rounded-lg"
  >
    📱 LINEで連絡する
    <span className="block text-xs font-normal mt-1">当日の追加注文や質問はLINEでお気軽にどうぞ</span>
  </a>
)}
```

`reservation.id` 変数名は既存コードに合わせる（`reservation` or `data` or `r` など、Read で確認した変数名を使用）。

- [ ] **Step 3: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```

- [ ] **Step 4: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/reserve/lookup/[id]/page.tsx" && git commit -m "feat(b7a): add LINE bind button to reservation lookup page"
```

---

### Task 10: 予約確認メールに LINE 連携ボタン追加

**Files:**
- Modify: `emails/ReservationConfirm.tsx`

- [ ] **Step 1: 既存ファイルを Read で確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && cat emails/ReservationConfirm.tsx
```
予約番号・日程表示箇所、および props で渡される変数名（`reservationId` か `id` か `model.id` か）を特定。

- [ ] **Step 2: ボタン挿入**

既存表示の予約情報セクション直下に以下を挿入（必要なら `Section` を `@react-email/components` から import 追加）:

```tsx
{process.env.NEXT_PUBLIC_LIFF_ID && (
  <Section style={{ marginTop: 24, textAlign: 'center' as const }}>
    <a
      href={`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?reservationId=${reservationId}`}
      style={{
        display: 'inline-block', padding: '12px 24px',
        backgroundColor: '#06C755', color: '#fff', textDecoration: 'none',
        borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
      }}
    >
      📱 LINEで連絡する
    </a>
    <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
      当日の追加注文や質問はLINEでお気軽にどうぞ
    </p>
  </Section>
)}
```

`reservationId` 変数名は既存 props に合わせる（Read で確認）。

- [ ] **Step 3: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```

- [ ] **Step 4: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add emails/ReservationConfirm.tsx && git commit -m "feat(b7a): add LINE bind button to reservation confirmation email"
```

---

### Task 11: `.env.example` 更新

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 既存内容を確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && cat .env.example
```

- [ ] **Step 2: 既存末尾に追記**

以下を `.env.example` の末尾に追加（既に存在する変数は重複追加しない）:

```dotenv
# === B-7a LINE integration ===
# Messaging API channel
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_OWNER_USER_ID=
# LINE Login channel (for LIFF idToken verify)
LINE_LOGIN_CHANNEL_ID=
# LIFF
NEXT_PUBLIC_LIFF_ID=
```

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add .env.example && git commit -m "feat(b7a): add LINE env vars to .env.example"
```

---

### Task 12: 全テスト・ビルド確認 + デプロイ + 手動疎通

**Files:** なし（インフラ作業）

- [ ] **Step 1: 全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
```
Expected: 203 PASS（189 既存 + 14 新規）

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし（既存の `types/reservation.test.ts` の 2 件のみ）

- [ ] **Step 3: 本番ビルド**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | grep -E "/line|/api/line" 
```
Expected:
```
├ ƒ /api/line/bind
├ ƒ /api/line/webhook
├ ○ /line/bind
```

- [ ] **Step 4: ブランチを main に merge + push**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git checkout main && git merge --ff-only feat/b7a-line-binding && git push origin main 2>&1 | tail -3
```

- [ ] **Step 5: Vercel 本番デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vercel --prod 2>&1 | tail -5
```
Expected: ● Ready / Aliased: https://bluesky-camp.vercel.app

- [ ] **Step 6: 手動オペレーター作業の案内**

ユーザー（オーナー）にお願い:

1. **LINE Developers コンソール** で以下を設定:
   - Messaging API チャネル > Webhook URL = `https://bluesky-camp.vercel.app/api/line/webhook`、Verify ボタン押下で `Success`
   - Messaging API チャネル > Webhook 利用 = ON、応答メッセージ = OFF
   - LIFF アプリ追加: Endpoint URL = `https://bluesky-camp.vercel.app/line/bind`、Size = Compact、Scope = `profile openid`
   - 別途 **LINE Login チャネル** を作成（同じ Provider 配下）→ Channel ID をメモ
2. **Vercel 環境変数** に Production / Preview の両方を設定:
   - `LINE_CHANNEL_ACCESS_TOKEN`（Messaging API）
   - `LINE_CHANNEL_SECRET`（Messaging API）
   - `LINE_OWNER_USER_ID`（自分の LINE userId、Webhook で1回受信して line_messages から確認）
   - `LINE_LOGIN_CHANNEL_ID`（LINE Login）
   - `NEXT_PUBLIC_LIFF_ID`（LIFF アプリ ID）
3. 環境変数追加後 `npx vercel --prod` でもう一度デプロイ

- [ ] **Step 7: 疎通確認チェックリスト**

ユーザーに以下の手動確認をお願い:

1. 既存予約照会ページで「LINEで連絡する」ボタンが表示される
2. ボタンタップ → LIFF が開き「✅ 連携完了！」表示
3. Supabase で `reservations.line_user_id` が更新されている
4. LINE 公式アカウントに自分（オーナー）から1通送信 → `line_messages` に sender='owner' で INSERT
5. 別 LINE アカウント（お客様役）から1通送信 → sender='customer' で INSERT、自動 reply「メッセージありがとうございます ✨...」が返る
6. 同じ message.id を再送（テスト不可なら飛ばす） → 重複なし

---

## 完了基準

- 全 203 テスト pass
- 本番ビルド成功、新規 3 ルート登録
- Vercel デプロイ Ready
- 手動疎通 6 項目すべて成功
- ブランチ `feat/b7a-line-binding` を main に merge 済

完了後、B-7b（AI 抽出 + sale_drafts + 承認UI）を別ブレストで開始する。

