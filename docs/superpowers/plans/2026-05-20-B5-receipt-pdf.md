# サブプロジェクト B-5：領収書PDF＋お客様向け再ダウンロードページ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** お客様が予約番号＋メールで照合し、領収書PDFをいつでもオンデマンドDLできるページとAPIを追加する。2回目以降のDLには「再発行」マークが入る。

**Architecture:** 純粋ロジック（`matchReservation` / `determineIsReissue`）を TDD で固め、`@react-pdf/renderer` で PDF テンプレート2種を作成。公開 API 2 本（lookup・download）と公開ページ `/receipts` を新設。既存 B-3 メールには DL ボタンを追加し、ReceiptModel / CancellationFeeModel に `reservationId` を追加。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin), TypeScript, Vitest, `@react-pdf/renderer`, TailwindCSS warm palette。

**参照スペック:** `docs/superpowers/specs/2026-05-20-B5-receipt-pdf-design.md`

---

## 前提知識（実装者向け）
- 既存（B-3）: `lib/receipt/build.ts` の `buildReceiptModel(reservation, pricing, saleLines, options)` と `buildCancellationFeeModel(reservation, fee, cancelledAt)`。`lib/receipt/types.ts` の `ReceiptModel`, `CancellationFeeModel`。`emails/ReceiptEmail.tsx`, `emails/CancellationFeeReceipt.tsx`。`receipt_logs` テーブル（columns: id, reservation_id, type, sent_to, total_amount, trigger, sent_at）。
- 既存（A）: `lib/pricing.ts` の `calcBreakdown`, `calcNights`。`lib/cancellation.ts` の `calcCancellationFee`。
- `lib/receipt/sendReceipt.ts` の `sendReceiptForReservation` のリピーター判定ロジック（`user_id` で 1件以上）。
- `lib/supabase.ts` の `supabaseAdmin`。
- 既存メール送信は Gmail SMTP（B-3 で構築済み）。
- `NEXT_PUBLIC_SITE_URL` で本番URL取得。
- 既存テスト総数 179。
- シェル: Bash（Git Bash）。パス `C:/Users/biscu/Downloads/bluesky-camp`。

---

### Task 1: 純粋ロジック `matchReservation` + `determineIsReissue`

**Files:**
- Create: `lib/receipt/lookup.ts`
- Test: `lib/receipt/__tests__/lookup.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/receipt/__tests__/lookup.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { matchReservation, determineIsReissue } from '../lookup'

describe('matchReservation', () => {
  const r = { id: 'abc-123', guest_email: 'taro@example.com' }
  it('returns true on exact match', () => {
    expect(matchReservation('abc-123', 'taro@example.com', r)).toBe(true)
  })
  it('normalizes email case', () => {
    expect(matchReservation('abc-123', 'Taro@Example.com', r)).toBe(true)
  })
  it('normalizes email whitespace', () => {
    expect(matchReservation('abc-123', '  taro@example.com  ', r)).toBe(true)
  })
  it('returns false on id mismatch', () => {
    expect(matchReservation('xxx', 'taro@example.com', r)).toBe(false)
  })
  it('returns false on email mismatch', () => {
    expect(matchReservation('abc-123', 'other@example.com', r)).toBe(false)
  })
  it('returns false on empty input', () => {
    expect(matchReservation('', 'taro@example.com', r)).toBe(false)
    expect(matchReservation('abc-123', '', r)).toBe(false)
  })
})

describe('determineIsReissue', () => {
  it('false for empty logs', () => {
    expect(determineIsReissue('receipt', [])).toBe(false)
  })
  it('false when only other-type logs exist', () => {
    expect(determineIsReissue('receipt', [{ type: 'cancellation_fee' }])).toBe(false)
  })
  it('true with 1 matching log', () => {
    expect(determineIsReissue('receipt', [{ type: 'receipt' }])).toBe(true)
  })
  it('true with multiple matching logs', () => {
    expect(determineIsReissue('receipt', [
      { type: 'receipt' }, { type: 'receipt' }, { type: 'cancellation_fee' },
    ])).toBe(true)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/receipt/__tests__/lookup.test.ts 2>&1 | tail -10`
Expected: FAIL（モジュール未解決）

- [ ] **Step 3: 実装 `lib/receipt/lookup.ts`**

```typescript
export function matchReservation(
  reservationId: string,
  email: string,
  reservation: { id: string; guest_email: string },
): boolean {
  if (!reservationId || !email) return false
  if (reservationId !== reservation.id) return false
  return reservation.guest_email.trim().toLowerCase() === email.trim().toLowerCase()
}

export function determineIsReissue(type: string, logs: { type: string }[]): boolean {
  return logs.filter(l => l.type === type).length >= 1
}
```

- [ ] **Step 4: テスト成功＋全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/receipt/__tests__/lookup.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
```
Expected: lookup 10 passed、全体 pass（179 + 10 = 189）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/receipt/lookup.ts lib/receipt/__tests__/lookup.test.ts && git commit -m "feat(b5): matchReservation + determineIsReissue pure logic"
```

---

### Task 2: types/build に reservationId 追加

**Files:**
- Modify: `lib/receipt/types.ts`
- Modify: `lib/receipt/build.ts`
- Modify: `lib/receipt/__tests__/build.test.ts`

- [ ] **Step 1: 既存テストに reservationId 検証を追加**

`lib/receipt/__tests__/build.test.ts` を読み、既存の `it('builds reservation lines + sales + grand total', ...)` の最後の `expect(m.saleLines[0].amount).toBe(6000)` の直後に追加:

```typescript
    expect(m.reservationId).toBe(baseReservation.id)
```

既存の `describe('buildCancellationFeeModel', ...)` の `it('builds fee model', ...)` の最後の `expect(m.cancelledAt).toBe('2026-08-13')` の直後に追加:

```typescript
    expect(m.reservationId).toBe(baseReservation.id)
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/receipt/__tests__/build.test.ts 2>&1 | tail -10`
Expected: FAIL（型エラー or undefined）

- [ ] **Step 3: 型定義に reservationId を追加 `lib/receipt/types.ts`**

`ReceiptModel` インターフェース に追加:
```typescript
  reservationId: string
```
`CancellationFeeModel` インターフェース に追加:
```typescript
  reservationId: string
```

- [ ] **Step 4: build.ts で reservationId を設定**

`lib/receipt/build.ts` の `buildReceiptModel` の return オブジェクトに追加（既存の `guestName: reservation.guest_name,` の直後に挿入）:
```typescript
    reservationId: reservation.id,
```

`buildCancellationFeeModel` の return オブジェクトにも同じく追加（`guestName: reservation.guest_name,` の直後）:
```typescript
    reservationId: reservation.id,
```

- [ ] **Step 5: テスト成功＋全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/receipt/__tests__/build.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
```
Expected: build 4 passed・新規 tsc エラーなし・全体 pass（189）

- [ ] **Step 6: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/receipt/types.ts lib/receipt/build.ts lib/receipt/__tests__/build.test.ts && git commit -m "feat(b5): add reservationId to receipt/cancellation models"
```

---

### Task 3: PDF テンプレート（styles + 2 PDF + renderToBuffer）

**Files:**
- Modify: `package.json`（`npm install`）
- Create: `lib/receipt/pdf/styles.ts`
- Create: `lib/receipt/pdf/renderToBuffer.ts`
- Create: `lib/receipt/pdf/ReceiptPdf.tsx`
- Create: `lib/receipt/pdf/CancellationFeePdf.tsx`

- [ ] **Step 1: `@react-pdf/renderer` を追加**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm install @react-pdf/renderer 2>&1 | tail -3
```

- [ ] **Step 2: `lib/receipt/pdf/styles.ts` を作成**

```typescript
import { Font, StyleSheet } from '@react-pdf/renderer'

// Noto Sans JP（Google Fonts）。Bold は別途登録。
Font.register({
  family: 'Noto Sans JP',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vY0rw-oME.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6pfjtqLzI2JPCgQBnw7HFQoggM-FNthvIU.ttf', fontWeight: 'bold' },
  ],
})

export const colors = {
  warm700: '#8a6e54',
  warm500: '#a16745',
  warm300: '#c9a87e',
  warm100: '#f0e3d2',
  red500:  '#dc2626',
  green600:'#16a34a',
  textDim: '#888888',
}

export const styles = StyleSheet.create({
  page:        { padding: 50, fontFamily: 'Noto Sans JP', fontSize: 10, color: colors.warm700 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  brand:       { fontSize: 18, color: colors.warm500, fontWeight: 'bold' },
  title:       { fontSize: 14, color: colors.warm700, marginTop: 4 },
  reissue:     { fontSize: 12, color: colors.red500, fontWeight: 'bold' },
  issuedAt:    { fontSize: 9, color: colors.textDim, marginTop: 2 },
  hr:          { borderBottom: 1, borderColor: colors.warm100, marginVertical: 10 },
  small:       { fontSize: 10, color: colors.warm700 },
  smallDim:    { fontSize: 9, color: colors.textDim, marginTop: 2 },
  sectionTitle:{ fontSize: 11, color: colors.warm500, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel:    { fontSize: 10, color: colors.warm700, flex: 1 },
  rowAmount:   { fontSize: 10, color: colors.warm700, textAlign: 'right' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTop: 0.5, borderColor: colors.warm100, marginTop: 4 },
  subtotal:    { fontSize: 10, color: colors.warm700, fontWeight: 'bold' },
  discount:    { fontSize: 10, color: colors.green600 },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTop: 1, borderBottom: 1, borderColor: colors.warm300, marginTop: 12 },
  totalLabel:  { fontSize: 14, color: colors.warm500, fontWeight: 'bold' },
  totalAmount: { fontSize: 14, color: colors.warm500, fontWeight: 'bold' },
  feeAmount:   { fontSize: 14, color: colors.red500, fontWeight: 'bold' },
  footer:      { fontSize: 9, color: colors.textDim, marginTop: 24, textAlign: 'center' },
})
```

- [ ] **Step 3: `lib/receipt/pdf/renderToBuffer.ts` を作成**

```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

export async function renderPdfToBuffer(doc: ReactElement): Promise<Buffer> {
  return await renderToBuffer(doc)
}
```

- [ ] **Step 4: `lib/receipt/pdf/ReceiptPdf.tsx` を作成**

```tsx
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './styles'
import type { ReceiptModel } from '@/lib/receipt/types'

interface Props { model: ReceiptModel; isReissue: boolean; issuedAt: string }

const yen = (n: number) => `¥${n.toLocaleString()}`

export default function ReceiptPdf({ model, isReissue, issuedAt }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>@blueSky</Text>
            <Text style={styles.title}>ご利用明細領収書</Text>
          </View>
          <View>
            {isReissue && <Text style={styles.reissue}>再発行</Text>}
            <Text style={styles.issuedAt}>発行日: {issuedAt}</Text>
          </View>
        </View>

        <Text style={styles.small}>{model.guestName} 様</Text>
        <Text style={styles.smallDim}>ご利用日: {model.checkinDate} 〜 {model.checkoutDate}（{model.nights}泊）</Text>
        <Text style={styles.smallDim}>予約番号: {model.reservationShortId}</Text>

        <View style={styles.hr} />
        <Text style={styles.sectionTitle}>ご予約料金</Text>
        {model.reservationLines.map((l, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>{l.label}</Text>
            <Text style={styles.rowAmount}>{yen(l.amount)}</Text>
          </View>
        ))}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotal}>小計</Text>
          <Text style={styles.subtotal}>{yen(model.reservationSubtotal)}</Text>
        </View>
        {model.repeaterDiscount > 0 && (
          <View style={styles.row}>
            <Text style={styles.discount}>リピーター割引 −10%</Text>
            <Text style={styles.discount}>−{yen(model.repeaterDiscount)}</Text>
          </View>
        )}

        {model.saleLines.length > 0 && (
          <>
            <View style={styles.hr} />
            <Text style={styles.sectionTitle}>追加販売</Text>
            {model.saleLines.map((s, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.rowLabel}>{s.date} {s.itemName} {yen(s.unitPrice)} × {s.quantity}</Text>
                <Text style={styles.rowAmount}>{yen(s.amount)}</Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotal}>販売小計</Text>
              <Text style={styles.subtotal}>{yen(model.salesSubtotal)}</Text>
            </View>
          </>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>合計</Text>
          <Text style={styles.totalAmount}>{yen(model.grandTotal)}</Text>
        </View>

        <Text style={styles.footer}>またのご利用をお待ちしております。 @blueSky</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 5: `lib/receipt/pdf/CancellationFeePdf.tsx` を作成**

```tsx
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './styles'
import type { CancellationFeeModel } from '@/lib/receipt/types'

interface Props { model: CancellationFeeModel; isReissue: boolean; issuedAt: string }
const yen = (n: number) => `¥${n.toLocaleString()}`

export default function CancellationFeePdf({ model, isReissue, issuedAt }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>@blueSky</Text>
            <Text style={styles.title}>キャンセル料明細書</Text>
          </View>
          <View>
            {isReissue && <Text style={styles.reissue}>再発行</Text>}
            <Text style={styles.issuedAt}>発行日: {issuedAt}</Text>
          </View>
        </View>

        <Text style={styles.small}>{model.guestName} 様</Text>
        <Text style={styles.smallDim}>予約番号: {model.reservationShortId}</Text>
        <Text style={styles.smallDim}>ご予約日程: {model.checkinDate} 〜 {model.checkoutDate}</Text>
        <Text style={styles.smallDim}>キャンセル日: {model.cancelledAt}</Text>

        <View style={styles.hr} />
        <Text style={styles.sectionTitle}>キャンセル料</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>合計金額</Text>
          <Text style={styles.rowAmount}>{yen(model.totalAmount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>適用率</Text>
          <Text style={styles.rowAmount}>{model.feeLabel}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>ご請求額</Text>
          <Text style={styles.feeAmount}>{yen(model.feeAmount)}</Text>
        </View>

        <Text style={styles.footer}>お振込先・お問い合わせは下記までお願いします。 @blueSky</Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 6: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add package.json package-lock.json lib/receipt/pdf && git commit -m "feat(b5): PDF templates (ReceiptPdf + CancellationFeePdf) with @react-pdf/renderer"
```
Expected: 新規 tsc エラーなし

---

### Task 4: 公開API（lookup + download）

**Files:**
- Create: `app/api/receipts/lookup/route.ts`
- Create: `app/api/receipts/download/route.ts`

- [ ] **Step 1: `app/api/receipts/lookup/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchReservation } from '@/lib/receipt/lookup'

export async function POST(req: NextRequest) {
  let body: { reservationId?: string; email?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { reservationId, email } = body
  if (!reservationId || !email)
    return NextResponse.json({ error: '予約番号とメールアドレスが必要です' }, { status: 400 })

  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('id, guest_email, guest_name, checkin_date, checkout_date')
    .eq('id', reservationId).maybeSingle()
  if (!r || !matchReservation(reservationId, email, r))
    return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })

  const { data: logs } = await supabaseAdmin
    .from('receipt_logs').select('type, sent_at')
    .eq('reservation_id', reservationId)
    .order('sent_at', { ascending: false })

  // 各 type の最新のみ
  const latestByType = new Map<string, string>()
  for (const l of logs ?? []) {
    if (!latestByType.has(l.type)) latestByType.set(l.type, l.sent_at)
  }
  const receipts = Array.from(latestByType.entries()).map(([type, sentAt]) => ({ type, sentAt }))

  return NextResponse.json({
    reservation: {
      shortId: r.id.slice(0, 8).toUpperCase(),
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
      guestName: r.guest_name,
    },
    receipts,
  })
}
```

- [ ] **Step 2: `app/api/receipts/download/route.ts` を作成**

```typescript
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchReservation, determineIsReissue } from '@/lib/receipt/lookup'
import { buildReceiptModel, buildCancellationFeeModel } from '@/lib/receipt/build'
import { calcCancellationFee } from '@/lib/cancellation'
import { renderPdfToBuffer } from '@/lib/receipt/pdf/renderToBuffer'
import ReceiptPdf from '@/lib/receipt/pdf/ReceiptPdf'
import CancellationFeePdf from '@/lib/receipt/pdf/CancellationFeePdf'
import type { ReservationRow, PricingItem } from '@/types/reservation'
import type { SaleLineRow } from '@/lib/receipt/types'

export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get('id')
  const type  = req.nextUrl.searchParams.get('type')
  const email = req.nextUrl.searchParams.get('email')
  if (!id || !email || (type !== 'receipt' && type !== 'cancellation_fee'))
    return new Response('Bad Request', { status: 400 })

  const { data: r } = await supabaseAdmin
    .from('reservations').select('*').eq('id', id).maybeSingle()
  if (!r || !matchReservation(id, email, r))
    return new Response('Not Found', { status: 404 })
  const reservation = r as ReservationRow

  const { data: logs } = await supabaseAdmin
    .from('receipt_logs').select('type').eq('reservation_id', id)
  const isReissue = determineIsReissue(type, logs ?? [])
  const issuedAt = new Date().toISOString().slice(0, 10)

  let buf: Buffer
  let filename: string
  if (type === 'receipt') {
    const [{ data: pricingRows }, { data: saleLines }] = await Promise.all([
      supabaseAdmin.from('pricing').select('*').eq('active', true),
      supabaseAdmin.from('sale_lines').select('*').eq('reservation_id', id),
    ])
    const pricing: PricingItem[] = (pricingRows ?? []).map((p: { item_key: string; label: string; amount: number; active: boolean }) => ({
      itemKey: p.item_key, label: p.label, amount: p.amount, active: p.active,
    }))
    let isRepeater = false
    if (reservation.user_id) {
      const { count } = await supabaseAdmin
        .from('reservations').select('*', { count: 'exact', head: true })
        .eq('user_id', reservation.user_id).neq('id', reservation.id)
      isRepeater = (count ?? 0) >= 1
    }
    const model = buildReceiptModel(reservation, pricing, (saleLines ?? []) as SaleLineRow[], { isRepeater })
    buf = await renderPdfToBuffer(ReceiptPdf({ model, isReissue, issuedAt }))
    filename = `receipt-${model.reservationShortId}.pdf`
  } else {
    const fee = calcCancellationFee(reservation.checkin_date, reservation.total_amount)
    const model = buildCancellationFeeModel(reservation, fee, issuedAt)
    buf = await renderPdfToBuffer(CancellationFeePdf({ model, isReissue, issuedAt }))
    filename = `cancellation-fee-${model.reservationShortId}.pdf`
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 3: 型チェック＋全テスト＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/api/receipts/lookup" "app/api/receipts/download" && git commit -m "feat(b5): public lookup + PDF download APIs"
```
Expected: 新規型エラーなし、テスト 189 pass

---

### Task 5: 公開ページ `/receipts`

**Files:**
- Create: `app/receipts/page.tsx`
- Create: `app/receipts/ReceiptLookupForm.tsx`

- [ ] **Step 1: `app/receipts/page.tsx` を作成**

```tsx
import ReceiptLookupForm from './ReceiptLookupForm'

export const metadata = {
  title: '領収書ダウンロード | @blueSky',
  robots: { index: false, follow: false },
}

interface Props { searchParams: { id?: string } }

export default function ReceiptsPage({ searchParams }: Props) {
  return (
    <main className="min-h-screen bg-warm-50 py-16 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="font-serif text-3xl text-warm-700 mb-2">領収書ダウンロード</h1>
        <p className="text-warm-400 text-sm mb-8">予約番号とご登録メールアドレスを入力してください。</p>
        <ReceiptLookupForm defaultReservationId={searchParams.id ?? ''} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: `app/receipts/ReceiptLookupForm.tsx` を作成**

```tsx
'use client'
import { useState } from 'react'

interface Receipt { type: string; sentAt: string }
interface Reservation { shortId: string; checkinDate: string; checkoutDate: string; guestName: string }
interface LookupResult { reservation: Reservation; receipts: Receipt[] }

const TYPE_LABEL: Record<string, string> = {
  receipt: '総合領収書',
  cancellation_fee: 'キャンセル料明細書',
}

export default function ReceiptLookupForm({ defaultReservationId }: { defaultReservationId: string }) {
  const [reservationId, setReservationId] = useState(defaultReservationId)
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/receipts/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, email }),
      })
      const json = await res.json()
      if (res.status === 404) { setError('予約番号またはメールアドレスが正しくありません'); return }
      if (!res.ok) { setError(json.error ?? 'エラーが発生しました'); return }
      setResult(json)
    } catch {
      setError('エラーが発生しました。時間をおいて再度お試しください')
    } finally { setLoading(false) }
  }

  const reset = () => { setResult(null); setError(null) }

  if (result) {
    const { reservation, receipts } = result
    return (
      <div className="bg-white border border-warm-100 rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-warm-400 text-xs">予約番号 {reservation.shortId}</p>
          <p className="font-medium text-warm-700">{reservation.guestName} 様</p>
          <p className="text-warm-500 text-sm">{reservation.checkinDate} 〜 {reservation.checkoutDate}</p>
        </div>

        {receipts.length === 0 ? (
          <p className="text-warm-400 text-sm py-4">まだ領収書は発行されていません。チェックアウト後の発行をお待ちください。</p>
        ) : (
          <div className="space-y-3">
            {receipts.map(r => (
              <div key={r.type} className="border border-warm-100 rounded-xl p-4">
                <p className="font-medium text-warm-700">📄 {TYPE_LABEL[r.type] ?? r.type}</p>
                <p className="text-warm-400 text-xs mt-1">最終送信 {new Date(r.sentAt).toLocaleString('ja-JP')}</p>
                <a
                  href={`/api/receipts/download?id=${encodeURIComponent(reservationId)}&type=${r.type}&email=${encodeURIComponent(email)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm"
                >
                  PDFをダウンロード
                </a>
              </div>
            ))}
            <p className="text-warm-300 text-xs">※ 2回目以降のDLには「再発行」が記載されます。</p>
          </div>
        )}

        <button onClick={reset} className="text-warm-500 text-sm hover:text-warm-700">← 別の予約を検索</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white border border-warm-100 rounded-2xl p-6 space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-warm-500 mb-1">予約番号</label>
        <input
          type="text" required
          value={reservationId}
          onChange={e => setReservationId(e.target.value)}
          placeholder="例: 12345678-..."
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-sm text-warm-500 mb-1">ご登録メールアドレス</label>
        <input
          type="email" required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
      </div>
      <button
        type="submit" disabled={loading}
        className="w-full bg-warm-500 hover:bg-warm-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '照合中...' : '領収書を表示'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: ビルド＋全テスト＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/receipts" && git commit -m "feat(b5): public /receipts page (lookup form + receipt list with PDF download)"
```
Expected: 型エラーなし・ビルド成功（`/receipts` がルートに出る）・テスト 189 pass

---

### Task 6: メールテンプレに PDF ダウンロードボタン追加

**Files:**
- Modify: `emails/ReceiptEmail.tsx`
- Modify: `emails/CancellationFeeReceipt.tsx`

- [ ] **Step 1: `emails/ReceiptEmail.tsx` を読んで構造を確認**

ファイル内で `SITE_URL` 相当の変数定義を確認。B-3 で作成された既存テンプレに `siteUrl`/`SITE` プロパティ等が渡されているかチェック。`reservationId` は props に含まれていないので、`model.reservationId` から取得する。

- [ ] **Step 2: ReceiptEmail に DL ボタンを追加**

`emails/ReceiptEmail.tsx` の **合計行（grandTotal を表示している Row）の直後** に挿入（既存ファイルを Read して合計表示の場所を特定し、その下に追加）:

```tsx
          <Section style={{ marginTop: 16, textAlign: 'center' as const }}>
            <a
              href={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/receipts?id=${model.reservationId}`}
              style={{
                display: 'inline-block', padding: '10px 20px',
                backgroundColor: '#a16745', color: '#fff', textDecoration: 'none',
                borderRadius: '8px', fontSize: '14px',
              }}
            >
              📄 領収書PDFをダウンロード
            </a>
          </Section>
```

- [ ] **Step 3: CancellationFeeReceipt に同じく追加**

`emails/CancellationFeeReceipt.tsx` の **ご請求額（feeAmount を表示している Row）の直後** に同じ Section を挿入（href と表示文言だけ確認）:

```tsx
          <Section style={{ marginTop: 16, textAlign: 'center' as const }}>
            <a
              href={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/receipts?id=${model.reservationId}`}
              style={{
                display: 'inline-block', padding: '10px 20px',
                backgroundColor: '#a16745', color: '#fff', textDecoration: 'none',
                borderRadius: '8px', fontSize: '14px',
              }}
            >
              📄 明細書PDFをダウンロード
            </a>
          </Section>
```

両ファイルとも `Section` が既に import されているか確認。なければ既存の `@react-email/components` import に `Section` を追加。

- [ ] **Step 4: 型チェック＋ビルド＋テスト＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add emails/ReceiptEmail.tsx emails/CancellationFeeReceipt.tsx && git commit -m "feat(b5): add PDF download button to receipt/cancellation emails"
```
Expected: 型エラーなし・ビルド成功・テスト 189 pass

---

### Task 7: デプロイ＋本番動作確認

**Files:** なし（インフラ作業）

- [ ] **Step 1: 型・テスト最終チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -15
```
Expected: 型エラーなし・テスト 189 pass・ビルド成功・`/receipts` と `/api/receipts/lookup` `/api/receipts/download` がルート一覧に出る

- [ ] **Step 2: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`

- [ ] **Step 3: 動作確認（手動）**

1. 既存予約に対し管理画面で「領収書を送信」→ Gmail 受信確認
2. メール内の「PDF ダウンロード」ボタンをクリック → `/receipts?id=...` が開き、予約 ID が自動入力されている
3. 登録メールを入力 → 領収書一覧表示
4. 「PDFをダウンロード」→ PDF が新タブで開く（または DL される）
5. もう一度同じ DL → PDF に「再発行」マークが入っていることを確認（receipt_logs に1件以上あるため）
6. 予約をテストでキャンセル → キャンセル料明細書メール受信 → 同じく PDF DL 確認
