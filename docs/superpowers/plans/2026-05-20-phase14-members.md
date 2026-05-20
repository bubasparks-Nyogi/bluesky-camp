# Phase 14 Members (Magic Link Auth + Repeater Discount) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** Optional member accounts via Supabase Auth magic link. Members get a "my page" with reservation history. Repeater members (2+ stays) get automatic 10% discount.

**Architecture:**
- Supabase Auth with magic link (email OTP / passwordless).
- New `profiles` table (1:1 with `auth.users`) for display info.
- `reservations.user_id` nullable column — set automatically on insert when session exists; retroactively linked by email match at signup.
- Repeater discount: if `user_id` has 1+ prior reservation, apply 10% off in pricing calc.
- New routes: `/auth/login`, `/auth/callback`, `/mypage`.
- Header shows login state via new `AuthNav` client component.

**Tech Stack:** Next.js 14 App Router, Supabase Auth (magic link), TypeScript, Vitest, TailwindCSS warm palette.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/007_phase14.sql` | Create | `profiles` table, `reservations.user_id` column, retroactive-link trigger |
| `lib/pricing.ts` | Modify | Add `isRepeater` param → 10% discount |
| `lib/__tests__/pricing.test.ts` | Modify | Add repeater discount tests |
| `lib/supabase-server.ts` | (unchanged, reused) | |
| `lib/supabase-browser.ts` | Create or reuse | Browser-side Supabase client (anon) |
| `app/auth/login/page.tsx` | Create | Magic link request form |
| `app/auth/callback/route.ts` | Create | Exchange code for session |
| `app/auth/signout/route.ts` | Create | Signout POST |
| `app/mypage/page.tsx` | Create | Member dashboard: stay count, tier, history |
| `app/api/reservations/route.ts` | Modify | Attach `user_id` if session exists |
| `components/AuthNav.tsx` | Create | Header login/logout button |
| `components/reserve/ReserveFlow.tsx` | Modify | Pre-fill from profile, pass `isRepeater` to pricing |
| `app/api/repeater-status/route.ts` | Create | Returns `{ isRepeater: boolean, stayCount: number }` for logged-in user |
| `app/layout.tsx` or `components/Header.tsx` | Modify | Mount `<AuthNav />` |

---

### Task 1: SQL migration + pricing.ts repeater logic + tests

**Files:**
- Create: `supabase/migrations/007_phase14.sql`
- Modify: `lib/pricing.ts`
- Modify: `lib/__tests__/pricing.test.ts` (or create if not present)

- [ ] **Step 1: Create `supabase/migrations/007_phase14.sql`**

```sql
-- supabase/migrations/007_phase14.sql

CREATE TABLE profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  phone        text,
  prefecture   text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_own"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Add user_id to existing reservations table (nullable for guest bookings)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations (user_id);

-- Trigger: when a new auth.users row is created, also create a profile row
-- and link any pre-existing reservations with the same email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  UPDATE public.reservations SET user_id = NEW.id WHERE email = NEW.email AND user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Read `lib/pricing.ts` to understand current shape**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && cat lib/pricing.ts
```

- [ ] **Step 3: Modify `lib/pricing.ts` to add repeater discount**

The function that computes total should accept an optional `isRepeater: boolean` parameter. Apply 10% discount to subtotal when `isRepeater === true`. Round to integer yen.

Specifically, find the main calculation function (likely `calculateTotal` or similar). After computing the base subtotal but before returning, add:

```typescript
if (options?.isRepeater) {
  total = Math.floor(total * 0.9)
}
```

Pass `options` (object with `isRepeater`) as last parameter. If the function already takes an options object, extend it. Maintain backward compatibility (default `isRepeater: false`).

- [ ] **Step 4: Add repeater discount tests to `lib/__tests__/pricing.test.ts`**

Add tests:
- Without `isRepeater`: produces the existing baseline total.
- With `isRepeater: true`: total equals `Math.floor(baseline * 0.9)`.
- With `isRepeater: false` (explicit): same as baseline.

If `pricing.test.ts` doesn't exist, create it with minimal valid coverage importing the actual function. Keep all other existing tests passing.

- [ ] **Step 5: Run tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/pricing.test.ts 2>&1 | tail -20
```

- [ ] **Step 6: Run full test suite**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/007_phase14.sql lib/pricing.ts lib/__tests__/pricing.test.ts && git commit -m "feat: add profiles table SQL + repeater discount in pricing"
```

---

### Task 2: Auth pages + browser client + AuthNav

**Files:**
- Create: `lib/supabase-browser.ts` (if not exists; check first)
- Create: `app/auth/login/page.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/signout/route.ts`
- Create: `components/AuthNav.tsx`
- Modify: `components/Header.tsx` (or wherever header lives) to mount `<AuthNav />`

- [ ] **Step 1: Check for existing browser Supabase client**

```bash
ls "C:/Users/biscu/Downloads/bluesky-camp/lib/" | grep -i supabase
```

If `lib/supabase-browser.ts` exists, reuse it. If not, create:

```typescript
// lib/supabase-browser.ts
'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Verify `@supabase/ssr` is installed:
```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && grep '"@supabase/ssr"' package.json
```
If missing: `npm install @supabase/ssr`

- [ ] **Step 2: Create `app/auth/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { SITE_URL } from '@/lib/seo-constants'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent,  setSent]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <main className="min-h-screen bg-warm-50 flex items-center justify-center px-4 py-16">
      <div className="bg-white border border-warm-100 rounded-2xl p-8 max-w-md w-full">
        <h1 className="font-serif text-2xl text-warm-700 text-center mb-2">ログイン / 新規登録</h1>
        <p className="text-warm-400 text-sm text-center mb-8">メールアドレスに送られるリンクをクリックしてログインします</p>

        {sent ? (
          <div className="text-center">
            <div className="text-3xl mb-3">📬</div>
            <p className="text-warm-700 font-medium mb-1">メールを送信しました</p>
            <p className="text-warm-400 text-sm">{email} に届くリンクをクリックしてください。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div>
              <label className="block text-sm text-warm-500 mb-1">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-warm-500 hover:bg-warm-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? '送信中...' : 'マジックリンクを送信'}
            </button>
            <p className="text-warm-300 text-xs text-center">初めての方も同じフォームから登録できます</p>
          </form>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Create `app/auth/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const next = req.nextUrl.searchParams.get('next') ?? '/mypage'
  if (code) {
    const supabase = createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL(next, req.url))
}
```

- [ ] **Step 4: Create `app/auth/signout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST() {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Create `components/AuthNav.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function AuthNav() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  const handleSignout = async () => {
    await fetch('/auth/signout', { method: 'POST' })
    setEmail(null)
    router.refresh()
  }

  if (loading) return null

  if (email) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/mypage" className="text-warm-600 hover:text-warm-700">👤 マイページ</Link>
        <button onClick={handleSignout} className="text-warm-400 hover:text-warm-600">ログアウト</button>
      </div>
    )
  }

  return (
    <Link href="/auth/login" className="text-sm text-warm-500 hover:text-warm-700">ログイン</Link>
  )
}
```

- [ ] **Step 6: Mount `<AuthNav />` in header**

```bash
ls "C:/Users/biscu/Downloads/bluesky-camp/components/" | grep -i header
```

Read the header file (likely `components/Header.tsx`). Import `AuthNav` and add it near the right side of the nav. Maintain existing styling — minimal change.

- [ ] **Step 7: TypeScript check**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/supabase-browser.ts app/auth/login/page.tsx app/auth/callback/route.ts app/auth/signout/route.ts components/AuthNav.tsx components/Header.tsx package.json package-lock.json 2>/dev/null ; git commit -m "feat: magic link auth pages + AuthNav header component"
```

---

### Task 3: Mypage + repeater-status API + reservation integration

**Files:**
- Create: `app/mypage/page.tsx`
- Create: `app/api/repeater-status/route.ts`
- Modify: `app/api/reservations/route.ts` (attach `user_id` if session exists)
- Modify: `components/reserve/ReserveFlow.tsx` (pre-fill from profile, pass isRepeater)

- [ ] **Step 1: Create `app/mypage/page.tsx`**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const metadata = { title: 'マイページ' }

export default async function MyPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: reservations } = await supabaseAdmin
    .from('reservations')
    .select('id, checkin, checkout, num_adults, num_children, total_amount, status, created_at')
    .eq('user_id', user.id)
    .order('checkin', { ascending: false })

  const stays = reservations ?? []
  const stayCount = stays.length
  const isRepeater = stayCount >= 1
  const tierLabel = isRepeater ? 'リピーター（10% OFF適用）' : 'ノーマル会員'

  return (
    <main className="min-h-screen bg-warm-50 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl text-warm-700 mb-2">マイページ</h1>
        <p className="text-warm-400 text-sm mb-8">{user.email}</p>

        <div className="bg-white border border-warm-100 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-warm-400 text-xs mb-1">会員ステータス</p>
              <p className="font-bold text-warm-700 text-lg">{tierLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-warm-400 text-xs mb-1">累計予約</p>
              <p className="font-bold text-warm-700 text-2xl">{stayCount}<span className="text-sm text-warm-400 ml-1">回</span></p>
            </div>
          </div>
        </div>

        <h2 className="font-serif text-xl text-warm-700 mb-4">予約履歴</h2>
        {stays.length === 0 ? (
          <p className="text-center text-warm-400 py-12 bg-white border border-warm-100 rounded-2xl">
            予約履歴はまだありません
          </p>
        ) : (
          <div className="space-y-3">
            {stays.map(r => (
              <div key={r.id} className="bg-white border border-warm-100 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <span className="font-medium text-warm-700">
                    {r.checkin} 〜 {r.checkout}
                  </span>
                  <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">
                    {r.status}
                  </span>
                </div>
                <p className="text-warm-500 text-sm">
                  大人{r.num_adults}名{r.num_children > 0 ? ` / 子供${r.num_children}名` : ''} · 合計 ¥{r.total_amount?.toLocaleString() ?? '-'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link href="/reserve" className="inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-6 py-3 rounded-lg transition-colors">
            新しい予約をする
          </Link>
        </div>
      </div>
    </main>
  )
}
```

NOTE: The exact columns of `reservations` may differ. If `num_adults`/`num_children`/`total_amount` columns are named differently, adjust accordingly. Read the existing reservations schema first:
```bash
grep -r "CREATE TABLE reservations" "C:/Users/biscu/Downloads/bluesky-camp/supabase/migrations/"
```

- [ ] **Step 2: Create `app/api/repeater-status/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ isRepeater: false, stayCount: 0 })

  const { count } = await supabaseAdmin
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const stayCount = count ?? 0
  return NextResponse.json({ isRepeater: stayCount >= 1, stayCount })
}
```

- [ ] **Step 3: Modify `app/api/reservations/route.ts` to attach `user_id`**

Read the file. Find the `POST` insert. Before the `.insert(...)` call, add:

```typescript
const supabaseAuth = createSupabaseServerClient()
const { data: { user } } = await supabaseAuth.auth.getUser()
```

(import `createSupabaseServerClient` from `@/lib/supabase-server` at top of file)

Then in the insert object, add `user_id: user?.id ?? null`.

- [ ] **Step 4: Modify `components/reserve/ReserveFlow.tsx` to use repeater discount**

Read the file. After initial state setup, add a `useEffect` that fetches `/api/repeater-status` and stores `isRepeater` in state. Pass `isRepeater` to the pricing calculation wherever total is computed.

If pricing is currently computed inline, find that call site and add `isRepeater` parameter. If pricing is computed in a sub-component (e.g., `Step4Confirmation`), thread the prop through.

Also: pre-fill name/email/phone from `/api/profile` or from `user.email` directly (use `createSupabaseBrowserClient`). For minimum scope, only pre-fill `email` from `user.email` if user is logged in — keep name/phone empty (user fills manually). Document this.

- [ ] **Step 5: TypeScript check + tests**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20 && npx vitest run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/mypage/page.tsx app/api/repeater-status/route.ts app/api/reservations/route.ts components/reserve/ReserveFlow.tsx && git commit -m "feat: mypage + repeater status + reservation user_id linkage"
```

---

### Task 4: SQL migration in Supabase + Supabase Auth email template config + deploy

- [ ] **Step 1: Copy SQL to clipboard**

```bash
cat "C:/Users/biscu/Downloads/bluesky-camp/supabase/migrations/007_phase14.sql" | clip
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

Open `https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new` and Run.

- [ ] **Step 3: Verify profiles table + reservations.user_id column**

```bash
node -e "
const https = require('https');
const k = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/profiles?limit=1',headers:{'Authorization':'Bearer '+k,'apikey':k}},r=>console.log('profiles:',r.statusCode===200?'OK':'ERR '+r.statusCode));
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/reservations?select=user_id&limit=1',headers:{'Authorization':'Bearer '+k,'apikey':k}},r=>console.log('reservations.user_id:',r.statusCode===200?'OK':'ERR '+r.statusCode));
"
```

- [ ] **Step 4: (Manual) Confirm Supabase Auth redirect URLs include site**

Open Supabase Dashboard → Authentication → URL Configuration. Verify:
- Site URL = `https://bluesky-camp.vercel.app`
- Redirect URLs include `https://bluesky-camp.vercel.app/**`

- [ ] **Step 5: Deploy**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
