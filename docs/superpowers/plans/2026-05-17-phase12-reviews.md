# Phase 12 Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guest review/testimonial system: guests can submit star ratings + comments, admins approve reviews, approved reviews display on the home page with average rating.

**Architecture:** `reviews` Supabase table with `is_published` flag. Public API allows unauthenticated POST (new review, pending) and GET (published only). Admin API requires session for list/approve/delete. Home page `ReviewSection` is a Server Component that fetches published reviews and renders a `ReviewForm` Client Component for new submissions. Admin dashboard gets a `ReviewManager` page.

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin for server, RLS for public), TypeScript, Vitest, TailwindCSS warm palette.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/005_phase12.sql` | Create | `reviews` table + indexes + RLS policies |
| `app/api/reviews/route.ts` | Create | GET (published) + POST (submit, no auth) |
| `app/api/admin/reviews/route.ts` | Create | GET all reviews (admin auth required) |
| `app/api/admin/reviews/[id]/route.ts` | Create | PATCH (toggle publish) + DELETE (admin auth) |
| `components/home/ReviewSection.tsx` | Create | Server Component: fetch + render reviews + avg rating |
| `components/home/ReviewForm.tsx` | Create | Client Component: star picker + comment form + submit |
| `components/admin/ReviewManager.tsx` | Create | Client Component: table with approve/delete actions |
| `app/admin/(dashboard)/reviews/page.tsx` | Create | Admin page: fetch all, render ReviewManager |
| `app/page.tsx` | Modify | Add `<ReviewSection />` between FaqSection and Contact |
| `app/admin/(dashboard)/layout.tsx` | Modify | Add `⭐ レビュー管理` nav link |
| `lib/__tests__/reviews.test.ts` | Create | Unit tests for validation logic |

---

### Task 1: SQL migration + API routes

**Files:**
- Create: `supabase/migrations/005_phase12.sql`
- Create: `app/api/reviews/route.ts`
- Create: `app/api/admin/reviews/route.ts`
- Create: `app/api/admin/reviews/[id]/route.ts`
- Create: `lib/__tests__/reviews.test.ts`

- [ ] **Step 1: Create `lib/__tests__/reviews.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'

// Validation logic mirroring what the API will do
function validateReview(body: Record<string, unknown>): string | null {
  if (!body.guest_name || typeof body.guest_name !== 'string' || (body.guest_name as string).trim().length === 0) {
    return 'guest_name が必要です'
  }
  if (!body.comment || typeof body.comment !== 'string' || (body.comment as string).trim().length === 0) {
    return 'comment が必要です'
  }
  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'rating は 1〜5 の整数で指定してください'
  }
  return null
}

describe('validateReview', () => {
  it('returns null for valid review', () => {
    expect(validateReview({ guest_name: '田中太郎', comment: '最高でした', rating: 5 })).toBeNull()
  })

  it('rejects missing guest_name', () => {
    expect(validateReview({ comment: '最高', rating: 4 })).toBe('guest_name が必要です')
  })

  it('rejects empty guest_name', () => {
    expect(validateReview({ guest_name: '  ', comment: '最高', rating: 4 })).toBe('guest_name が必要です')
  })

  it('rejects missing comment', () => {
    expect(validateReview({ guest_name: '田中', rating: 3 })).toBe('comment が必要です')
  })

  it('rejects rating out of range (0)', () => {
    expect(validateReview({ guest_name: '田中', comment: 'ok', rating: 0 })).toBe('rating は 1〜5 の整数で指定してください')
  })

  it('rejects rating out of range (6)', () => {
    expect(validateReview({ guest_name: '田中', comment: 'ok', rating: 6 })).toBe('rating は 1〜5 の整数で指定してください')
  })

  it('rejects non-integer rating', () => {
    expect(validateReview({ guest_name: '田中', comment: 'ok', rating: 4.5 })).toBe('rating は 1〜5 の整数で指定してください')
  })
})
```

- [ ] **Step 2: Run tests (should PASS — logic is self-contained)**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/reviews.test.ts 2>&1
```
Expected: 7 tests PASS

- [ ] **Step 3: Create `supabase/migrations/005_phase12.sql`**

```sql
-- supabase/migrations/005_phase12.sql

CREATE TABLE reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name   text        NOT NULL,
  rating       integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text        NOT NULL,
  visit_date   date,
  is_published boolean     NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_reviews_is_published ON reviews (is_published);
CREATE INDEX idx_reviews_created_at   ON reviews (created_at DESC);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read_published" ON reviews FOR SELECT USING (is_published = true);
CREATE POLICY "reviews_insert"         ON reviews FOR INSERT WITH CHECK (true);
```

- [ ] **Step 4: Create `app/api/reviews/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('id, guest_name, rating, comment, visit_date, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviews: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const { guest_name, rating, comment, visit_date } = body

  if (!guest_name || typeof guest_name !== 'string' || (guest_name as string).trim().length === 0) {
    return NextResponse.json({ error: 'guest_name が必要です' }, { status: 400 })
  }
  if (!comment || typeof comment !== 'string' || (comment as string).trim().length === 0) {
    return NextResponse.json({ error: 'comment が必要です' }, { status: 400 })
  }
  const ratingNum = Number(rating)
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: 'rating は 1〜5 の整数で指定してください' }, { status: 400 })
  }

  const insertData: Record<string, unknown> = {
    guest_name: (guest_name as string).trim(),
    rating: ratingNum,
    comment: (comment as string).trim(),
    is_published: false,
  }
  if (visit_date && typeof visit_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(visit_date)) {
    insertData.visit_date = visit_date
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .insert(insertData)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data, message: 'レビューを受け付けました。確認後に公開されます。' }, { status: 201 })
}
```

- [ ] **Step 5: Create `app/api/admin/reviews/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviews: data ?? [] })
}
```

- [ ] **Step 6: Create `app/api/admin/reviews/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  if (body.is_published === undefined) {
    return NextResponse.json({ error: 'is_published が必要です' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('reviews')
    .update({ is_published: Boolean(body.is_published) })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('reviews')
    .delete()
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Run all tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: all pass (57 tests)

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/005_phase12.sql app/api/reviews/route.ts app/api/admin/reviews/route.ts "app/api/admin/reviews/[id]/route.ts" lib/__tests__/reviews.test.ts && git commit -m "feat: add reviews API routes and SQL migration"
```

---

### Task 2: ReviewForm + ReviewSection (home page)

**Files:**
- Create: `components/home/ReviewForm.tsx`
- Create: `components/home/ReviewSection.tsx`

- [ ] **Step 1: Create `components/home/ReviewForm.tsx`**

```tsx
'use client'
import { useState } from 'react'

export default function ReviewForm() {
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [rating, setRating]   = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: name, rating, comment }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '送信に失敗しました'); return }
      setDone(true)
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="text-center mt-10">
        <button
          onClick={() => setOpen(true)}
          className="inline-block border border-warm-300 text-warm-500 hover:bg-warm-100 px-6 py-2 rounded-full text-sm transition-colors"
        >
          ✏️ クチコミを書く
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mt-8 bg-warm-50 border border-warm-200 rounded-xl p-6 text-center max-w-md mx-auto">
        <div className="text-2xl mb-2">🙏</div>
        <p className="text-warm-600 font-medium">レビューありがとうございます！</p>
        <p className="text-warm-400 text-sm mt-1">確認後に公開されます。</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 bg-warm-50 border border-warm-200 rounded-xl p-6 max-w-md mx-auto space-y-4">
      <h3 className="font-serif text-warm-600 font-bold text-lg">クチコミを投稿</h3>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div>
        <label className="block text-sm text-warm-500 mb-1">お名前 <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="田中 太郎"
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-2">評価 <span className="text-red-400">*</span></label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`text-2xl transition-transform hover:scale-110 ${n <= rating ? 'opacity-100' : 'opacity-30'}`}
              aria-label={`${n}つ星`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-warm-500 mb-1">コメント <span className="text-red-400">*</span></label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          required
          rows={4}
          placeholder="滞在の感想をお聞かせください..."
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
        >
          {submitting ? '送信中...' : '投稿する'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2.5 border border-warm-200 text-warm-400 hover:bg-warm-100 rounded-lg text-sm transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create `components/home/ReviewSection.tsx`**

```tsx
import { supabaseAdmin } from '@/lib/supabase'
import ReviewForm from './ReviewForm'

interface Review {
  id: string
  guest_name: string
  rating: number
  comment: string
  visit_date: string | null
  created_at: string
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating}つ星`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= rating ? 'text-yellow-400' : 'text-warm-200'}>★</span>
      ))}
    </span>
  )
}

async function getReviews(): Promise<Review[]> {
  const { data } = await supabaseAdmin
    .from('reviews')
    .select('id, guest_name, rating, comment, visit_date, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function ReviewSection() {
  const reviews = await getReviews()

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <section id="reviews" className="py-20 px-4 bg-white">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-serif text-2xl md:text-3xl text-warm-600 mb-2">クチコミ</h2>
          <p className="text-warm-400 text-sm tracking-widest mb-4">REVIEWS</p>
          {avgRating && (
            <div className="inline-flex items-center gap-2 bg-warm-50 border border-warm-200 rounded-full px-4 py-2">
              <span className="text-yellow-400 text-lg">★</span>
              <span className="font-bold text-warm-700 text-lg">{avgRating}</span>
              <span className="text-warm-400 text-sm">/ 5（{reviews.length}件）</span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="text-center text-warm-300 text-sm py-8">まだクチコミはありません</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-warm-50 rounded-xl p-5 border border-warm-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-warm-700 text-sm">{r.guest_name}</span>
                  <StarDisplay rating={r.rating} />
                </div>
                <p className="text-warm-600 text-sm leading-relaxed">{r.comment}</p>
                {r.visit_date && (
                  <p className="text-warm-300 text-xs mt-2">{r.visit_date} ご宿泊</p>
                )}
              </div>
            ))}
          </div>
        )}

        <ReviewForm />
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Update `app/page.tsx` — add ReviewSection between FaqSection and Contact**

The current `app/page.tsx` ends with:
```tsx
      <Access />
      <FaqSection faqs={faqs} />
      <Contact />
```

Change it to:
```tsx
      <Access />
      <FaqSection faqs={faqs} />
      <ReviewSection />
      <Contact />
```

Also add the import at the top:
```tsx
import ReviewSection    from '@/components/home/ReviewSection'
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | head -15
```
Expected: no new errors

- [ ] **Step 5: Run all tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/home/ReviewForm.tsx components/home/ReviewSection.tsx app/page.tsx && git commit -m "feat: add ReviewSection and ReviewForm to home page"
```

---

### Task 3: Admin ReviewManager + page + nav link

**Files:**
- Create: `components/admin/ReviewManager.tsx`
- Create: `app/admin/(dashboard)/reviews/page.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `components/admin/ReviewManager.tsx`**

```tsx
'use client'
import { useState } from 'react'

interface Review {
  id: string
  guest_name: string
  rating: number
  comment: string
  visit_date: string | null
  is_published: boolean
  created_at: string
}

interface Props {
  initialReviews: Review[]
}

export default function ReviewManager({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)

  const togglePublish = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current }),
    })
    if (res.ok) {
      setReviews(rs => rs.map(r => r.id === id ? { ...r, is_published: !current } : r))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このレビューを削除しますか？')) return
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setReviews(rs => rs.filter(r => r.id !== id))
    }
  }

  if (reviews.length === 0) {
    return <p className="text-warm-400 text-sm">レビューはまだありません。</p>
  }

  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <div key={r.id} className={`border rounded-xl p-5 ${r.is_published ? 'border-green-200 bg-green-50' : 'border-warm-200 bg-white'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <span className="font-medium text-warm-700">{r.guest_name}</span>
                <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_published ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-500'}`}>
                  {r.is_published ? '公開中' : '未承認'}
                </span>
              </div>
              <p className="text-warm-600 text-sm leading-relaxed mb-1">{r.comment}</p>
              <p className="text-warm-300 text-xs">
                {r.visit_date ? `${r.visit_date} ご宿泊 · ` : ''}
                投稿: {new Date(r.created_at).toLocaleDateString('ja-JP')}
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => togglePublish(r.id, r.is_published)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  r.is_published
                    ? 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {r.is_published ? '非公開にする' : '承認する'}
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors font-medium"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/(dashboard)/reviews/page.tsx`**

```tsx
import { supabaseAdmin } from '@/lib/supabase'
import ReviewManager from '@/components/admin/ReviewManager'

async function getAllReviews() {
  const { data } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminReviewsPage() {
  const reviews = await getAllReviews()
  const pending   = reviews.filter(r => !r.is_published).length
  const published = reviews.filter(r =>  r.is_published).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">レビュー管理</h1>
        <div className="flex gap-4 text-sm text-warm-500">
          <span>未承認: <strong className="text-orange-500">{pending}</strong></span>
          <span>公開中: <strong className="text-green-600">{published}</strong></span>
        </div>
      </div>
      <ReviewManager initialReviews={reviews} />
    </div>
  )
}
```

- [ ] **Step 3: Update `app/admin/(dashboard)/layout.tsx` — add reviews nav link**

In the nav items array, after `{ href: '/admin/faqs', label: '❓ FAQ管理' }`, add:

```typescript
{ href: '/admin/reviews', label: '⭐ レビュー管理' },
```

The full nav array becomes:
```typescript
[
  { href: '/admin',               label: '📅 予約カレンダー' },
  { href: '/admin/reservations',  label: '📋 予約一覧' },
  { href: '/admin/pricing',       label: '💴 料金設定' },
  { href: '/admin/rental-items',  label: '🎒 レンタル管理' },
  { href: '/admin/blocked-dates', label: '🚫 日程ブロック' },
  { href: '/admin/photos',        label: '📸 写真管理' },
  { href: '/admin/faqs',          label: '❓ FAQ管理' },
  { href: '/admin/reviews',       label: '⭐ レビュー管理' },
]
```

- [ ] **Step 4: Run TypeScript check**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | head -15
```
Expected: no new errors

- [ ] **Step 5: Run all tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/admin/ReviewManager.tsx "app/admin/(dashboard)/reviews/page.tsx" "app/admin/(dashboard)/layout.tsx" && git commit -m "feat: add admin review management page"
```

---

### Task 4: SQL migration + deploy

**Files:** None new (migration needs to run in Supabase, deploy to Vercel)

- [ ] **Step 1: Copy SQL migration to clipboard**

```bash
cat "C:/Users/biscu/Downloads/bluesky-camp/supabase/migrations/005_phase12.sql" | clip
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Open: `https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new`
Paste (Ctrl+V) and click **「走る」**

Expected: "成功。返された行はありません。"

- [ ] **Step 3: Verify reviews table exists**

```bash
node -e "
const https = require('https');
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/reviews?limit=1',headers:{'Authorization':'Bearer '+serviceRole,'apikey':serviceRole}},res=>{console.log('reviews table:',res.statusCode===200?'✅ OK':'❌ '+res.statusCode)}).on('error',e=>console.error(e.message));
" 2>&1
```
Expected: `reviews table: ✅ OK`

- [ ] **Step 4: Push and deploy to Vercel**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`
