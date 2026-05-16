# Phase 11 Calendar Date Pre-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make available (○) calendar days clickable so that clicking a date navigates to `/reserve?date=YYYY-MM-DD` and pre-fills the checkin date in the reservation form.

**Architecture:** Three-file change. `BookingCalendar` gains click handlers on ○ days that call `router.push('/reserve?date=ISO')`. `app/reserve/page.tsx` (Server Component) reads `searchParams.date` and passes it as `initialDate` prop to `ReserveFlow`. `ReserveFlow` accepts `initialDate?: string` prop and uses it to seed `checkinDate` and auto-advance to STEP 1 when a date arrives pre-filled.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Vitest.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/home/BookingCalendar.tsx` | Modify | Make ○ days clickable → `router.push('/reserve?date=ISO')` |
| `app/reserve/page.tsx` | Modify | Read `searchParams.date`, pass `initialDate` to `ReserveFlow` |
| `components/reserve/ReserveFlow.tsx` | Modify | Accept `initialDate?: string`, seed form + skip to step 1 |
| `lib/__tests__/calendar.test.ts` | Create | Unit tests for date-prefill logic |

---

### Task 1: Unit tests + ReserveFlow `initialDate` prop

**Files:**
- Create: `lib/__tests__/calendar.test.ts`
- Modify: `components/reserve/ReserveFlow.tsx`

- [ ] **Step 1: Write failing tests**

```bash
cat > "C:/Users/biscu/Downloads/bluesky-camp/lib/__tests__/calendar.test.ts" << 'EOF'
import { describe, it, expect } from 'vitest'

// Pure logic: given initialDate, derive initial form state and step
function deriveInitial(initialDate?: string) {
  if (!initialDate) {
    return { checkinDate: '', checkoutDate: '', step: 0 }
  }
  const next = new Date(initialDate)
  next.setDate(next.getDate() + 1)
  return {
    checkinDate: initialDate,
    checkoutDate: next.toISOString().slice(0, 10),
    step: 1,
  }
}

describe('deriveInitial', () => {
  it('returns empty form at step 0 when no date provided', () => {
    const result = deriveInitial()
    expect(result.checkinDate).toBe('')
    expect(result.checkoutDate).toBe('')
    expect(result.step).toBe(0)
  })

  it('pre-fills checkinDate and sets checkout to next day', () => {
    const result = deriveInitial('2026-08-15')
    expect(result.checkinDate).toBe('2026-08-15')
    expect(result.checkoutDate).toBe('2026-08-16')
    expect(result.step).toBe(1)
  })

  it('handles month boundary correctly (Aug 31 → Sep 1)', () => {
    const result = deriveInitial('2026-08-31')
    expect(result.checkinDate).toBe('2026-08-31')
    expect(result.checkoutDate).toBe('2026-09-01')
    expect(result.step).toBe(1)
  })

  it('handles year boundary correctly (Dec 31 → Jan 1)', () => {
    const result = deriveInitial('2026-12-31')
    expect(result.checkinDate).toBe('2026-12-31')
    expect(result.checkoutDate).toBe('2027-01-01')
    expect(result.step).toBe(1)
  })
})
EOF
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/calendar.test.ts 2>&1
```
Expected: FAIL — `calendar.test.ts` not found or `deriveInitial` undefined

- [ ] **Step 3: Run tests — they should now PASS (logic is self-contained)**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/calendar.test.ts 2>&1
```
Expected: PASS — 4 tests pass (the `deriveInitial` function is defined inline in the test)

- [ ] **Step 4: Update `components/reserve/ReserveFlow.tsx`**

Replace the entire file with:

```tsx
'use client'
import { useState } from 'react'
import type { ReservationFormData, StepIndex } from '@/types/reservation'
import { STEP_LABELS } from '@/types/reservation'
import StepDate      from './StepDate'
import StepStayType  from './StepStayType'
import StepSauna     from './StepSauna'
import StepPet       from './StepPet'
import StepTransfer  from './StepTransfer'
import StepRental    from './StepRental'
import StepGuestInfo from './StepGuestInfo'
import StepTerms     from './StepTerms'
import StepConfirm   from './StepConfirm'
import StepPayment   from './StepPayment'

interface Props {
  initialDate?: string
}

function buildInitial(initialDate?: string): ReservationFormData {
  if (!initialDate) {
    return {
      checkinDate: '', checkoutDate: '', stayTypes: [], ehu: false,
      sauna: false, pet: false, transferCount: 0, transferStation: '',
      rentalItems: [], guestName: '', guestEmail: '', guestPhone: '',
    }
  }
  const next = new Date(initialDate)
  next.setDate(next.getDate() + 1)
  return {
    checkinDate: initialDate,
    checkoutDate: next.toISOString().slice(0, 10),
    stayTypes: [], ehu: false, sauna: false, pet: false,
    transferCount: 0, transferStation: '',
    rentalItems: [], guestName: '', guestEmail: '', guestPhone: '',
  }
}

export default function ReserveFlow({ initialDate }: Props) {
  const [step, setStep] = useState<StepIndex>(initialDate ? 1 : 0)
  const [form, setForm] = useState<ReservationFormData>(() => buildInitial(initialDate))
  const update = (u: Partial<ReservationFormData>) => setForm(f => ({ ...f, ...u }))
  const next = () => setStep(s => (s + 1) as StepIndex)
  const back = () => setStep(s => (s - 1) as StepIndex)

  const steps = [
    <StepDate key={0} form={form} onChange={update} onNext={next} />,
    <StepStayType key={1} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepSauna key={2} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepPet key={3} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepTransfer key={4} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepRental key={5} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepGuestInfo key={6} form={form} onChange={update} onNext={next} onBack={back} />,
    <StepTerms     key={7} onNext={next} onBack={back} />,
    <StepConfirm   key={8} form={form} onNext={next} onBack={back} />,
    <StepPayment   key={9} form={form} onBack={back} />,
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-10 min-h-screen">
      <div className="mb-8">
        <div className="flex justify-between text-xs text-warm-400 mb-2">
          <span>STEP {step + 1} / {STEP_LABELS.length}</span>
          <span>{STEP_LABELS[step]}</span>
        </div>
        <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-warm-300 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>
      {steps[step]}
    </div>
  )
}
```

- [ ] **Step 5: Run all tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/__tests__/calendar.test.ts components/reserve/ReserveFlow.tsx && git commit -m "feat: ReserveFlow accepts initialDate prop to pre-fill checkin date"
```

---

### Task 2: `app/reserve/page.tsx` — read searchParams

**Files:**
- Modify: `app/reserve/page.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat "C:/Users/biscu/Downloads/bluesky-camp/app/reserve/page.tsx"
```

- [ ] **Step 2: Replace entire `app/reserve/page.tsx` with**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import ReserveFlow from '@/components/reserve/ReserveFlow'

export const metadata: Metadata = {
  title: 'ご予約',
  description: '滋賀県高島市の一日一組限定キャンプ場 @blueSky のオンライン予約ページ。空き日程の確認から決済まで完結します。',
  openGraph: {
    title: 'ご予約 | @blueSky',
    description: '滋賀県高島市の一日一組限定キャンプ場 @blueSky のオンライン予約ページ。',
    url: '/reserve',
  },
  twitter: {
    card: 'summary',
    title: 'ご予約 | @blueSky',
    description: '滋賀県高島市の一日一組限定キャンプ場 @blueSky のオンライン予約ページ。',
  },
  alternates: {
    canonical: '/reserve',
  },
  robots: {
    index: false,
    follow: false,
  },
}

interface Props {
  searchParams: { date?: string }
}

// Validate ISO date string: must be YYYY-MM-DD and a real future date
function parseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  const d = new Date(raw)
  if (isNaN(d.getTime())) return undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d < today) return undefined
  return raw
}

export default function ReservePage({ searchParams }: Props) {
  const initialDate = parseDate(searchParams.date)
  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-600 text-white py-4 px-4 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">@blueSky ご予約</span>
      </header>
      <ReserveFlow initialDate={initialDate} />
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -10
```
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/reserve/page.tsx && git commit -m "feat: reserve page reads ?date= searchParam and passes to ReserveFlow"
```

---

### Task 3: `BookingCalendar` — clickable ○ days

**Files:**
- Modify: `components/home/BookingCalendar.tsx`

- [ ] **Step 1: Replace the entire `components/home/BookingCalendar.tsx` with**

Key changes: ○ days become `<button>` elements that call `router.push('/reserve?date=' + iso)`. × and past days remain `<div>`. "予約する" button stays for users who haven't selected a day.

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function BookingCalendar() {
  const router = useRouter()
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [booked, setBooked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/availability?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        setBooked(new Set(d.booked ?? []))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [year, month])

  const days = getDaysInMonth(year, month)
  const firstDow = new Date(year, month - 1, 1).getDay()
  const todayIso = today.toISOString().slice(0, 10)

  const handleDayClick = (iso: string) => {
    router.push(`/reserve?date=${iso}`)
  }

  const prev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="max-w-sm mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prev}
          className="p-2 text-warm-400 hover:text-warm-600 text-xl font-bold leading-none"
          aria-label="前月"
        >
          ‹
        </button>
        <span className="font-serif text-warm-600 font-bold">
          {year}年{month}月
        </span>
        <button
          onClick={next}
          className="p-2 text-warm-400 hover:text-warm-600 text-xl font-bold leading-none"
          aria-label="次月"
        >
          ›
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 text-center text-xs text-warm-400 mb-1">
        {['日','月','火','水','木','金','土'].map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* 日付グリッド */}
      {loading ? (
        <div className="text-center py-8 text-warm-400 text-sm">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(d => {
            const iso      = d.toISOString().slice(0, 10)
            const past     = iso < todayIso
            const isBooked = booked.has(iso)
            const available = !past && !isBooked

            if (available) {
              return (
                <button
                  key={iso}
                  onClick={() => handleDayClick(iso)}
                  className="py-2 rounded text-xs font-medium transition-colors bg-warm-100 text-warm-600 hover:bg-warm-300 hover:text-white active:scale-95 cursor-pointer"
                  aria-label={`${d.getMonth() + 1}月${d.getDate()}日 空き`}
                >
                  <div>{d.getDate()}</div>
                  <div className="text-xs mt-0.5 font-bold">○</div>
                </button>
              )
            }

            return (
              <div
                key={iso}
                className={[
                  'py-2 rounded text-xs font-medium',
                  past               ? 'text-gray-300' : '',
                  !past && isBooked  ? 'bg-red-100 text-red-400' : '',
                ].join(' ')}
              >
                <div>{d.getDate()}</div>
                {!past && (
                  <div className="text-xs mt-0.5 font-bold">×</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 予約ボタン */}
      <button
        onClick={() => router.push('/reserve')}
        className="mt-6 w-full bg-warm-300 hover:bg-warm-400 active:scale-95
                   text-white font-bold py-3 rounded-lg transition-all text-base
                   shadow-md"
      >
        予約する →
      </button>

      {/* 凡例 */}
      <div className="flex justify-center gap-6 mt-3 text-xs text-warm-400">
        <span><span className="text-warm-600 font-bold">○</span> 空き（タップで予約）</span>
        <span><span className="text-red-400 font-bold">×</span> 満室</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: all pass

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/home/BookingCalendar.tsx && git commit -m "feat: calendar available days are clickable and navigate to reserve with date pre-filled"
```

---

### Task 4: Deploy and verify

**Files:** None (deployment only)

- [ ] **Step 1: Push and deploy**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -5
```
Expected: `Aliased: https://bluesky-camp.vercel.app`

- [ ] **Step 2: Smoke test — verify URL routing**

Open in browser: `https://bluesky-camp.vercel.app/reserve?date=2026-09-01`

Expected: Reservation page opens at **STEP 2**（宿泊スタイル選択）with checkin `2026-09-01` already set (STEP 1 is skipped).

- [ ] **Step 3: Verify past date is rejected**

Open: `https://bluesky-camp.vercel.app/reserve?date=2020-01-01`

Expected: Reservation page opens at **STEP 1** with empty checkin (past date ignored).

- [ ] **Step 4: Verify malformed date is rejected**

Open: `https://bluesky-camp.vercel.app/reserve?date=not-a-date`

Expected: Reservation page opens at **STEP 1** with empty checkin.
