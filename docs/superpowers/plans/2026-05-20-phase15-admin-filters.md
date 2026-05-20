# Phase 15 Admin Search & Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** Add search + filters to the three admin pages (`/admin/reservations`, `/admin/posts`, `/admin/reviews`) so the owner can find rows quickly as data grows.

**Architecture:**
- State lives in **URL searchParams** (reload/share safe).
- Each admin page is a Server Component that reads `searchParams`, applies filters to Supabase query, then renders a Client filter-bar component above the existing list.
- Filter bars use Next `useRouter` + `useSearchParams` to rewrite the URL via `router.replace()` on debounced input (300ms) or immediate on select change.
- Partial-match search uses Supabase `ilike` (`%q%`).
- No DB schema changes. No migration.

**Tech Stack:** Next.js 14 App Router, Supabase, TypeScript, TailwindCSS warm palette, debounce hook.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/useDebouncedValue.ts` | Create | Tiny debounce hook |
| `components/admin/ReservationFilters.tsx` | Create | Search input + status / stay_type / date-range selects + clear |
| `components/admin/PostFilters.tsx` | Create | Title search + category / publish-state selects + clear |
| `components/admin/ReviewFilters.tsx` | Create | Guest name search + publish-state select + clear |
| `app/admin/(dashboard)/reservations/page.tsx` | Modify | Read searchParams, build query with ilike + filters, mount `<ReservationFilters />` |
| `app/admin/(dashboard)/posts/page.tsx` | Modify | Read searchParams, filter, mount `<PostFilters />` |
| `app/admin/(dashboard)/reviews/page.tsx` | Modify | Read searchParams, filter, mount `<ReviewFilters />` |
| `lib/__tests__/admin-filter-params.test.ts` | Create | Unit tests for URL searchParam parsing util |
| `lib/admin-filter-params.ts` | Create | URL searchParam parse/serialize util |

---

### Task 1: Reservations filters (most complex)

**Files:**
- Create: `lib/useDebouncedValue.ts`
- Create: `lib/admin-filter-params.ts`
- Create: `lib/__tests__/admin-filter-params.test.ts`
- Create: `components/admin/ReservationFilters.tsx`
- Modify: `app/admin/(dashboard)/reservations/page.tsx`

#### Discovery

Read `app/admin/(dashboard)/reservations/page.tsx` to understand current shape. Identify:
- How the reservations rows are currently fetched (the supabase query).
- The exact column names (`guest_name`, `guest_email`, `guest_phone`, `status`, `stay_type`, `checkin_date`).

#### Files

- [ ] **Step 1: Create `lib/useDebouncedValue.ts`**

```typescript
'use client'
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
```

- [ ] **Step 2: Create `lib/admin-filter-params.ts`**

```typescript
// Tiny helpers for normalizing admin-page searchParam objects.
// We treat empty strings and "all" as "no filter".

export function nonEmpty(v: string | undefined | null): string | undefined {
  if (!v) return undefined
  const t = v.trim()
  if (!t || t === 'all') return undefined
  return t
}

export function buildSearch(qs: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(qs)) {
    if (v !== undefined && v !== '') params.set(k, v)
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}
```

- [ ] **Step 3: Create `lib/__tests__/admin-filter-params.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { nonEmpty, buildSearch } from '../admin-filter-params'

describe('nonEmpty', () => {
  it('returns undefined for undefined', () => {
    expect(nonEmpty(undefined)).toBeUndefined()
  })
  it('returns undefined for empty string', () => {
    expect(nonEmpty('')).toBeUndefined()
  })
  it('returns undefined for whitespace only', () => {
    expect(nonEmpty('   ')).toBeUndefined()
  })
  it('returns undefined for "all"', () => {
    expect(nonEmpty('all')).toBeUndefined()
  })
  it('returns trimmed value otherwise', () => {
    expect(nonEmpty('  hello  ')).toBe('hello')
  })
})

describe('buildSearch', () => {
  it('returns empty for all undefined', () => {
    expect(buildSearch({ q: undefined, s: undefined })).toBe('')
  })
  it('skips undefined and empty values', () => {
    expect(buildSearch({ q: 'a', s: undefined, t: '' })).toBe('?q=a')
  })
  it('serializes multiple params', () => {
    expect(buildSearch({ q: 'a', s: 'confirmed' })).toBe('?q=a&s=confirmed')
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/admin-filter-params.test.ts 2>&1
```
Expected: 8 PASS.

- [ ] **Step 5: Create `components/admin/ReservationFilters.tsx`**

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { buildSearch } from '@/lib/admin-filter-params'

const STATUS_OPTIONS = [
  { value: 'all',       label: 'すべてのステータス' },
  { value: 'pending',   label: '承認待ち' },
  { value: 'confirmed', label: '確定' },
  { value: 'cancelled', label: 'キャンセル' },
]

const STAY_OPTIONS = [
  { value: 'all',       label: 'すべての宿泊タイプ' },
  { value: 'day',       label: '日帰り' },
  { value: '1night',    label: '1泊' },
  { value: 'multi',     label: '連泊' },
]

interface Props { totalCount: number; visibleCount: number }

export default function ReservationFilters({ totalCount, visibleCount }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  const [q,      setQ]      = useState(sp.get('q')      ?? '')
  const [status, setStatus] = useState(sp.get('status') ?? 'all')
  const [stay,   setStay]   = useState(sp.get('stay')   ?? 'all')
  const [from,   setFrom]   = useState(sp.get('from')   ?? '')
  const [to,     setTo]     = useState(sp.get('to')     ?? '')

  const debouncedQ = useDebouncedValue(q, 300)

  useEffect(() => {
    const search = buildSearch({
      q:      debouncedQ || undefined,
      status: status === 'all' ? undefined : status,
      stay:   stay   === 'all' ? undefined : stay,
      from:   from   || undefined,
      to:     to     || undefined,
    })
    router.replace(`/admin/reservations${search}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, stay, from, to])

  const clear = () => {
    setQ(''); setStatus('all'); setStay('all'); setFrom(''); setTo('')
  }

  const hasActiveFilters = !!(q || status !== 'all' || stay !== 'all' || from || to)

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 mb-6 space-y-3">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 名前 / メール / 電話で検索"
          className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={stay} onChange={e => setStay(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {STAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid md:grid-cols-3 gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-warm-400 shrink-0">チェックイン:</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border border-warm-200 rounded-lg px-3 py-1.5 text-warm-700 focus:outline-none focus:border-warm-400 text-sm flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-warm-400 shrink-0">〜</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border border-warm-200 rounded-lg px-3 py-1.5 text-warm-700 focus:outline-none focus:border-warm-400 text-sm flex-1"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-warm-500">
            <strong className="text-warm-700">{visibleCount}</strong> / 全 {totalCount} 件
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-warm-500 hover:text-warm-700 underline"
            >
              フィルタをクリア
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Modify `app/admin/(dashboard)/reservations/page.tsx`**

Read the file first. Replace the existing data fetch with a version that:
1. Accepts `Props { searchParams: { q?: string; status?: string; stay?: string; from?: string; to?: string } }`
2. Builds a Supabase query like:

```typescript
let query = supabaseAdmin.from('reservations').select('*', { count: 'exact' }).order('checkin_date', { ascending: false })

if (searchParams.q) {
  const pattern = `%${searchParams.q}%`
  query = query.or(`guest_name.ilike.${pattern},guest_email.ilike.${pattern},guest_phone.ilike.${pattern}`)
}
if (searchParams.status && searchParams.status !== 'all') query = query.eq('status', searchParams.status)
if (searchParams.stay   && searchParams.stay   !== 'all') query = query.eq('stay_type', searchParams.stay)
if (searchParams.from)  query = query.gte('checkin_date', searchParams.from)
if (searchParams.to)    query = query.lte('checkin_date', searchParams.to)

const { data: reservations, count } = await query
```

Also fetch total count without filters for the "全X件" badge:
```typescript
const { count: totalCount } = await supabaseAdmin.from('reservations').select('*', { count: 'exact', head: true })
```

Then mount `<ReservationFilters totalCount={totalCount ?? 0} visibleCount={reservations?.length ?? 0} />` above the existing list, and pass `reservations` through to the existing rendering code.

- [ ] **Step 7: Run tests + TS check**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5 && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/useDebouncedValue.ts lib/admin-filter-params.ts lib/__tests__/admin-filter-params.test.ts components/admin/ReservationFilters.tsx "app/admin/(dashboard)/reservations/page.tsx" && git commit -m "feat: search and filters for admin reservations"
```

---

### Task 2: Posts + Reviews filters

**Files:**
- Create: `components/admin/PostFilters.tsx`
- Create: `components/admin/ReviewFilters.tsx`
- Modify: `app/admin/(dashboard)/posts/page.tsx`
- Modify: `app/admin/(dashboard)/reviews/page.tsx`

- [ ] **Step 1: Create `components/admin/PostFilters.tsx`**

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { buildSearch } from '@/lib/admin-filter-params'

const CATEGORY_OPTIONS = [
  { value: 'all',   label: 'すべてのカテゴリ' },
  { value: 'news',  label: 'お知らせ' },
  { value: 'event', label: 'イベント' },
  { value: 'blog',  label: 'ブログ' },
]

const PUBLISH_OPTIONS = [
  { value: 'all',         label: 'すべて' },
  { value: 'published',   label: '公開中のみ' },
  { value: 'unpublished', label: '下書きのみ' },
]

interface Props { totalCount: number; visibleCount: number }

export default function PostFilters({ totalCount, visibleCount }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [q,        setQ]        = useState(sp.get('q')       ?? '')
  const [category, setCategory] = useState(sp.get('category')?? 'all')
  const [publish,  setPublish]  = useState(sp.get('publish') ?? 'all')

  const debouncedQ = useDebouncedValue(q, 300)

  useEffect(() => {
    const search = buildSearch({
      q:        debouncedQ || undefined,
      category: category === 'all' ? undefined : category,
      publish:  publish  === 'all' ? undefined : publish,
    })
    router.replace(`/admin/posts${search}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, category, publish])

  const clear = () => { setQ(''); setCategory('all'); setPublish('all') }
  const hasActiveFilters = !!(q || category !== 'all' || publish !== 'all')

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 mb-6">
      <div className="grid md:grid-cols-3 gap-3 mb-3">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 タイトル検索"
          className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
        <select value={category} onChange={e => setCategory(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={publish} onChange={e => setPublish(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {PUBLISH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-warm-500"><strong className="text-warm-700">{visibleCount}</strong> / 全 {totalCount} 件</span>
        {hasActiveFilters && <button type="button" onClick={clear} className="text-warm-500 hover:text-warm-700 underline">フィルタをクリア</button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/admin/ReviewFilters.tsx`**

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { buildSearch } from '@/lib/admin-filter-params'

const PUBLISH_OPTIONS = [
  { value: 'all',         label: 'すべて' },
  { value: 'published',   label: '公開中のみ' },
  { value: 'unpublished', label: '未承認のみ' },
]

interface Props { totalCount: number; visibleCount: number }

export default function ReviewFilters({ totalCount, visibleCount }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [q,       setQ]       = useState(sp.get('q')       ?? '')
  const [publish, setPublish] = useState(sp.get('publish') ?? 'all')

  const debouncedQ = useDebouncedValue(q, 300)

  useEffect(() => {
    const search = buildSearch({
      q:       debouncedQ || undefined,
      publish: publish === 'all' ? undefined : publish,
    })
    router.replace(`/admin/reviews${search}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, publish])

  const clear = () => { setQ(''); setPublish('all') }
  const hasActiveFilters = !!(q || publish !== 'all')

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 mb-6">
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 ゲスト名 / コメント検索"
          className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
        <select value={publish} onChange={e => setPublish(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {PUBLISH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-warm-500"><strong className="text-warm-700">{visibleCount}</strong> / 全 {totalCount} 件</span>
        {hasActiveFilters && <button type="button" onClick={clear} className="text-warm-500 hover:text-warm-700 underline">フィルタをクリア</button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Modify `app/admin/(dashboard)/posts/page.tsx`**

Add `Props { searchParams: { q?: string; category?: string; publish?: string } }`. Build query:

```typescript
let query = supabaseAdmin.from('posts').select('*').order('created_at', { ascending: false })
if (searchParams.q)        query = query.ilike('title', `%${searchParams.q}%`)
if (searchParams.category && searchParams.category !== 'all') query = query.eq('category', searchParams.category)
if (searchParams.publish === 'published')   query = query.eq('is_published', true)
if (searchParams.publish === 'unpublished') query = query.eq('is_published', false)
```

Also fetch total count and mount `<PostFilters />` above the manager.

- [ ] **Step 4: Modify `app/admin/(dashboard)/reviews/page.tsx`**

Add `Props { searchParams: { q?: string; publish?: string } }`. Build query:

```typescript
let query = supabaseAdmin.from('reviews').select('*').order('created_at', { ascending: false })
if (searchParams.q) {
  const pat = `%${searchParams.q}%`
  query = query.or(`guest_name.ilike.${pat},comment.ilike.${pat}`)
}
if (searchParams.publish === 'published')   query = query.eq('is_published', true)
if (searchParams.publish === 'unpublished') query = query.eq('is_published', false)
```

Also fetch total count and mount `<ReviewFilters />`.

- [ ] **Step 5: TS check + tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20 && npx vitest run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/admin/PostFilters.tsx components/admin/ReviewFilters.tsx "app/admin/(dashboard)/posts/page.tsx" "app/admin/(dashboard)/reviews/page.tsx" && git commit -m "feat: search and filters for admin posts and reviews"
```

---

### Task 3: Deploy

- [ ] **Step 1: Push and deploy**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```

No SQL migration required.
