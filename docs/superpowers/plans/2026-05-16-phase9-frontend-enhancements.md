# Phase 9: フロント強化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写真スライドショー・FAQ管理・チェックイン日天気予報の3機能を追加し、ゲスト体験を向上させる

**Architecture:** Supabase に photos/faqs テーブルを追加して管理画面からコンテンツ編集可能にする。天気は Open-Meteo 無料APIをサーバーサイドで呼び出し、予約確認画面とメールに表示する。すべて既存の warm パレット / Next.js 14 App Router パターンに従う。

**Tech Stack:** Next.js 14 App Router, Supabase (DB + Storage), TailwindCSS warm, Open-Meteo API, react-email, TypeScript, Vitest

---

## ファイル構成

### 新規作成
```
supabase/migrations/004_phase9.sql
lib/weather.ts
app/api/weather/route.ts
app/api/photos/route.ts
app/api/admin/photos/route.ts
app/api/admin/photos/[id]/route.ts
app/api/faqs/route.ts
app/api/admin/faqs/route.ts
app/api/admin/faqs/[id]/route.ts
components/home/PhotoSlider.tsx
components/home/FaqSection.tsx
components/reserve/WeatherForecast.tsx
components/admin/PhotoManager.tsx
components/admin/FaqManager.tsx
app/admin/(dashboard)/photos/page.tsx
app/admin/(dashboard)/faqs/page.tsx
lib/weather.test.ts
```

### 修正
```
components/home/Hero.tsx              ← PhotoSlider を組み込む
components/home/Facilities.tsx        ← PhotoSlider を組み込む
app/page.tsx                          ← photos + faqs を Server で fetch
components/reserve/StepConfirm.tsx    ← WeatherForecast を追加
emails/ReservationConfirm.tsx         ← weather props を追加
lib/email.ts                          ← 天気データを sendReservationEmails に渡す
app/admin/(dashboard)/layout.tsx      ← ナビに写真・FAQ を追加
```

---

## Task 1: DBマイグレーション（photos + faqs テーブル）

**Files:**
- Create: `supabase/migrations/004_phase9.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
-- supabase/migrations/004_phase9.sql

-- 写真管理テーブル
CREATE TABLE photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url        text NOT NULL,
  caption    text,
  section    text NOT NULL CHECK (section IN ('hero', 'facilities')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos_read"   ON photos FOR SELECT USING (true);
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (true);
CREATE POLICY "photos_update" ON photos FOR UPDATE USING (true);
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (true);

-- FAQ管理テーブル
CREATE TABLE faqs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question     text NOT NULL,
  answer       text NOT NULL,
  category     text NOT NULL DEFAULT 'general'
                 CHECK (category IN ('general','pricing','access','facility')),
  sort_order   integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faqs_read"   ON faqs FOR SELECT USING (true);
CREATE POLICY "faqs_insert" ON faqs FOR INSERT WITH CHECK (true);
CREATE POLICY "faqs_update" ON faqs FOR UPDATE USING (true);
CREATE POLICY "faqs_delete" ON faqs FOR DELETE USING (true);
```

- [ ] **Step 2: Supabase に適用する**

Supabase Dashboard → SQL Editor に上記 SQL を貼り付けて実行する。
または `supabase db push`（CLI が設定済みの場合）。

- [ ] **Step 3: Supabase Storage バケットを作成する**

Supabase Dashboard → Storage → 「New bucket」
- Name: `photos`
- Public: ON（チェックを入れる）

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/004_phase9.sql
git commit -m "feat: add photos and faqs migration for phase 9"
```

---

## Task 2: 天気ライブラリ + API ルート

**Files:**
- Create: `lib/weather.ts`
- Create: `lib/weather.test.ts`
- Create: `app/api/weather/route.ts`

- [ ] **Step 1: テストを書く**

```typescript
// lib/weather.test.ts
import { describe, it, expect } from 'vitest'
import { weatherCodeToLabel, weatherCodeToIcon } from './weather'

describe('weatherCodeToLabel', () => {
  it('returns 晴れ for code 0', () => {
    expect(weatherCodeToLabel(0)).toBe('晴れ')
  })
  it('returns くもり for code 3', () => {
    expect(weatherCodeToLabel(3)).toBe('くもり')
  })
  it('returns 雨 for code 61', () => {
    expect(weatherCodeToLabel(61)).toBe('雨')
  })
  it('returns 雪 for code 71', () => {
    expect(weatherCodeToLabel(71)).toBe('雪')
  })
  it('returns 雷雨 for code 95', () => {
    expect(weatherCodeToLabel(95)).toBe('雷雨')
  })
  it('returns unknown label for unknown code', () => {
    expect(weatherCodeToLabel(999)).toBe('--')
  })
})

describe('weatherCodeToIcon', () => {
  it('returns ☀️ for code 0', () => {
    expect(weatherCodeToIcon(0)).toBe('☀️')
  })
  it('returns 🌧️ for code 61', () => {
    expect(weatherCodeToIcon(61)).toBe('🌧️')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npx vitest run lib/weather.test.ts
```

Expected: FAIL（`weather` モジュールが存在しないため）

- [ ] **Step 3: lib/weather.ts を実装する**

```typescript
// lib/weather.ts

export interface WeatherForecast {
  date:    string  // YYYY-MM-DD
  label:   string  // 晴れ / くもり / 雨 etc.
  icon:    string  // emoji
  tempMax: number  // ℃
  tempMin: number  // ℃
}

// @blueSky の場所：滋賀県高島市安曇川町
const LAT = 35.32
const LNG = 136.00

export function weatherCodeToLabel(code: number): string {
  if (code === 0)                   return '晴れ'
  if (code <= 3)                    return code === 1 ? '晴れ' : code === 2 ? '晴れ時々くもり' : 'くもり'
  if (code === 45 || code === 48)   return '霧'
  if (code >= 51 && code <= 55)     return '霧雨'
  if (code >= 61 && code <= 65)     return '雨'
  if (code >= 71 && code <= 75)     return '雪'
  if (code >= 80 && code <= 82)     return 'にわか雨'
  if (code === 95)                  return '雷雨'
  if (code >= 96 && code <= 99)     return '雷雨（雹）'
  return '--'
}

export function weatherCodeToIcon(code: number): string {
  if (code === 0)                   return '☀️'
  if (code <= 2)                    return '🌤️'
  if (code === 3)                   return '☁️'
  if (code === 45 || code === 48)   return '🌫️'
  if (code >= 51 && code <= 55)     return '🌦️'
  if (code >= 61 && code <= 65)     return '🌧️'
  if (code >= 71 && code <= 75)     return '❄️'
  if (code >= 80 && code <= 82)     return '🌦️'
  if (code >= 95)                   return '⛈️'
  return '🌡️'
}

export async function getWeatherForecast(date: string): Promise<WeatherForecast | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&timezone=Asia%2FTokyo&start_date=${date}&end_date=${date}`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null

    const data = await res.json()
    const daily = data.daily
    if (!daily?.time?.length) return null

    const code    = daily.weathercode[0]     as number
    const tempMax = daily.temperature_2m_max[0] as number
    const tempMin = daily.temperature_2m_min[0] as number

    return {
      date,
      label:   weatherCodeToLabel(code),
      icon:    weatherCodeToIcon(code),
      tempMax: Math.round(tempMax),
      tempMin: Math.round(tempMin),
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx vitest run lib/weather.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: API ルートを作成する**

```typescript
// app/api/weather/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getWeatherForecast } from '@/lib/weather'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date パラメーターが必要です（形式: YYYY-MM-DD）' }, { status: 400 })
  }
  const forecast = await getWeatherForecast(date)
  if (!forecast) return NextResponse.json({ forecast: null })
  return NextResponse.json({ forecast })
}
```

- [ ] **Step 6: コミット**

```bash
git add lib/weather.ts lib/weather.test.ts app/api/weather/route.ts
git commit -m "feat: add weather lib and API route (Open-Meteo)"
```

---

## Task 3: Photos API エンドポイント

**Files:**
- Create: `app/api/photos/route.ts`
- Create: `app/api/admin/photos/route.ts`
- Create: `app/api/admin/photos/[id]/route.ts`

- [ ] **Step 1: 公開 API を作成する**

```typescript
// app/api/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get('section')
  let query = supabaseAdmin.from('photos').select('*').order('sort_order')
  if (section) query = query.eq('section', section)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
}
```

- [ ] **Step 2: 管理用 CRUD API を作成する**

```typescript
// app/api/admin/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 写真一覧取得
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('photos').select('*').order('section').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
}

// 写真登録（Storage にアップロード済みの URL を受け取る）
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const section  = formData.get('section') as string | null
  const caption  = formData.get('caption') as string | null

  if (!file || !section) {
    return NextResponse.json({ error: 'file と section が必要です' }, { status: 400 })
  }

  // Storage にアップロード
  const ext      = file.name.split('.').pop()
  const filename = `${Date.now()}.${ext}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('photos').upload(filename, file, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // 公開 URL 取得
  const { data: { publicUrl } } = supabaseAdmin.storage.from('photos').getPublicUrl(filename)

  // DB に保存
  const { data, error } = await supabaseAdmin.from('photos')
    .insert({ url: publicUrl, caption: caption ?? null, section })
    .select().single()
  if (error) {
    await supabaseAdmin.storage.from('photos').remove([filename])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ photo: data }, { status: 201 })
}
```

```typescript
// app/api/admin/photos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// sort_order 更新
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sort_order } = await req.json()
  const { error } = await supabaseAdmin.from('photos')
    .update({ sort_order }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 削除（Storage + DB）
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // DB から URL を取得
  const { data: photo } = await supabaseAdmin.from('photos')
    .select('url').eq('id', params.id).single()

  if (photo) {
    // Storage からファイルを削除
    const filename = photo.url.split('/').pop()
    if (filename) {
      await supabaseAdmin.storage.from('photos').remove([filename])
    }
  }

  const { error } = await supabaseAdmin.from('photos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: コミット**

```bash
git add app/api/photos/route.ts app/api/admin/photos/route.ts app/api/admin/photos/[id]/route.ts
git commit -m "feat: add photos API endpoints"
```

---

## Task 4: FAQs API エンドポイント

**Files:**
- Create: `app/api/faqs/route.ts`
- Create: `app/api/admin/faqs/route.ts`
- Create: `app/api/admin/faqs/[id]/route.ts`

- [ ] **Step 1: 公開 API を作成する**

```typescript
// app/api/faqs/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('faqs')
    .select('*')
    .eq('is_published', true)
    .order('category')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faqs: data ?? [] })
}
```

- [ ] **Step 2: 管理用 CRUD API を作成する**

```typescript
// app/api/admin/faqs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('faqs').select('*').order('category').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faqs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { question, answer, category, sort_order, is_published } = body
  if (!question || !answer) {
    return NextResponse.json({ error: 'question と answer が必要です' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('faqs')
    .insert({ question, answer, category: category ?? 'general',
              sort_order: sort_order ?? 0, is_published: is_published ?? true })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faq: data }, { status: 201 })
}
```

```typescript
// app/api/admin/faqs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.question     !== undefined) update.question     = body.question
  if (body.answer       !== undefined) update.answer       = body.answer
  if (body.category     !== undefined) update.category     = body.category
  if (body.sort_order   !== undefined) update.sort_order   = body.sort_order
  if (body.is_published !== undefined) update.is_published = body.is_published

  const { error } = await supabaseAdmin.from('faqs').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin.from('faqs').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: コミット**

```bash
git add app/api/faqs/route.ts app/api/admin/faqs/route.ts app/api/admin/faqs/[id]/route.ts
git commit -m "feat: add FAQs API endpoints"
```

---

## Task 5: PhotoSlider コンポーネント

**Files:**
- Create: `components/home/PhotoSlider.tsx`

- [ ] **Step 1: PhotoSlider コンポーネントを作成する**

```typescript
// components/home/PhotoSlider.tsx
'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'

interface Photo {
  id:      string
  url:     string
  caption: string | null
}

interface Props {
  photos:    Photo[]
  className?: string
  interval?: number   // ミリ秒（デフォルト 4000）
}

export default function PhotoSlider({ photos, className = '', interval = 4000 }: Props) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (photos.length <= 1) return
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % photos.length)
    }, interval)
    return () => clearInterval(timer)
  }, [photos.length, interval])

  if (photos.length === 0) return null

  return (
    <div className={`relative w-full h-full ${className}`}>
      {photos.map((photo, i) => (
        <div
          key={photo.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Image
            src={photo.url}
            alt={photo.caption ?? '施設写真'}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ))}
      {/* インジケーター */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/home/PhotoSlider.tsx
git commit -m "feat: add PhotoSlider component"
```

---

## Task 6: Hero.tsx を PhotoSlider に対応させる

**Files:**
- Modify: `components/home/Hero.tsx`

現在の Hero.tsx は Unsplash の固定画像を使用している。photos テーブルの `section='hero'` の写真を表示し、写真が0枚の場合は既存の Unsplash 画像にフォールバックする。

- [ ] **Step 1: Hero.tsx を修正する**

```typescript
// components/home/Hero.tsx
import Image from 'next/image'
import Link from 'next/link'
import PhotoSlider from '@/components/home/PhotoSlider'

interface Photo {
  id:      string
  url:     string
  caption: string | null
}

interface Props {
  photos?: Photo[]
}

export default function Hero({ photos = [] }: Props) {
  const FALLBACK = 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600'

  return (
    <section id="hero" className="relative h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      {photos.length > 0 ? (
        <div className="absolute inset-0 brightness-50">
          <PhotoSlider photos={photos} className="w-full h-full" />
        </div>
      ) : (
        <Image
          src={FALLBACK}
          alt="焚き火のある夜のキャンプ場"
          fill
          className="object-cover brightness-50"
          priority
          unoptimized
        />
      )}
      <div className="relative z-10 text-center text-white px-4">
        <p className="text-sm md:text-base tracking-[0.3em] mb-4 text-warm-200">
          SHIGA / TAKASHIMA
        </p>
        <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl font-bold leading-snug mb-6">
          忙しい日常から<br />非日常へ。
        </h1>
        <p className="text-base md:text-lg text-warm-100 mb-8 max-w-md mx-auto">
          滋賀・高島市、一日一組限定。<br />
          焚き火・サウナ・ドラム缶風呂が待っています。
        </p>
        <Link href="#booking"
              className="inline-block bg-warm-300 hover:bg-warm-400 text-white font-bold px-8 py-3 rounded-full transition-colors text-base shadow-lg">
          空き状況を確認する
        </Link>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-xs tracking-widest animate-bounce">
        SCROLL ↓
      </div>
    </section>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/home/Hero.tsx
git commit -m "feat: Hero supports dynamic photo slider with fallback"
```

---

## Task 7: Facilities.tsx に写真スライドショーを追加する

**Files:**
- Modify: `components/home/Facilities.tsx`

- [ ] **Step 1: Facilities.tsx を修正する**

```typescript
// components/home/Facilities.tsx
import PhotoSlider from '@/components/home/PhotoSlider'

const ITEMS = [
  { icon: '🏕', label: 'テント設営スペース' },
  { icon: '🚌', label: 'キャンピングトレーラー 2棟' },
  { icon: '🚿', label: 'シャワー完備' },
  { icon: '🌡', label: 'ドラム缶風呂' },
  { icon: '🧖', label: '簡易サウナ' },
  { icon: '🐕', label: 'ペット可（小型犬まで）' },
  { icon: '📶', label: 'Wi-Fi完備' },
  { icon: '🔌', label: 'EHU外部電源（キャンピングカー用）' },
  { icon: '🚗', label: '駐車場あり' },
  { icon: '🎒', label: 'キャンプ道具レンタル' },
  { icon: '🚐', label: '送迎サービス' },
]

interface Photo {
  id:      string
  url:     string
  caption: string | null
}

interface Props {
  photos?: Photo[]
}

export default function Facilities({ photos = [] }: Props) {
  return (
    <section id="facilities" className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">設備</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">FACILITIES</p>

        {/* 施設写真スライドショー */}
        {photos.length > 0 && (
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden mb-12">
            <PhotoSlider photos={photos} />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {ITEMS.map(item => (
            <div key={item.label} className="flex flex-col items-center gap-2 p-4 bg-warm-50 rounded-xl text-center">
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-warm-600 leading-snug">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/home/Facilities.tsx
git commit -m "feat: Facilities supports photo slider"
```

---

## Task 8: FaqSection コンポーネント

**Files:**
- Create: `components/home/FaqSection.tsx`

- [ ] **Step 1: FaqSection コンポーネントを作成する**

```typescript
// components/home/FaqSection.tsx
'use client'
import { useState } from 'react'

const CATEGORY_LABELS: Record<string, string> = {
  general:  'よくある質問',
  pricing:  '料金について',
  access:   'アクセス・送迎',
  facility: '設備・施設',
}

interface Faq {
  id:       string
  question: string
  answer:   string
  category: string
}

interface Props {
  faqs: Faq[]
}

export default function FaqSection({ faqs }: Props) {
  const [openId,   setOpenId]   = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('general')

  if (faqs.length === 0) return null

  const categories = Array.from(new Set(faqs.map(f => f.category)))
  const filtered   = faqs.filter(f => f.category === activeTab)

  return (
    <section id="faq" className="py-20 px-4 bg-warm-50">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">よくある質問</h2>
        <p className="text-center text-warm-400 mb-10 text-sm tracking-widest">FAQ</p>

        {/* カテゴリタブ */}
        <div className="flex gap-2 flex-wrap mb-8 justify-center">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === cat
                  ? 'bg-warm-300 text-white'
                  : 'bg-white text-warm-500 border border-warm-200 hover:bg-warm-100'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* アコーディオン */}
        <div className="space-y-2">
          {filtered.map(faq => (
            <div key={faq.id} className="bg-white rounded-xl border border-warm-200 overflow-hidden">
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full text-left px-5 py-4 flex justify-between items-center gap-4"
              >
                <span className="text-sm font-medium text-warm-700">{faq.question}</span>
                <span className="text-warm-400 text-lg shrink-0">
                  {openId === faq.id ? '−' : '+'}
                </span>
              </button>
              {openId === faq.id && (
                <div className="px-5 pb-4 text-sm text-warm-500 leading-relaxed border-t border-warm-100 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/home/FaqSection.tsx
git commit -m "feat: add FaqSection accordion component"
```

---

## Task 9: app/page.tsx を更新して写真・FAQを渡す

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: app/page.tsx を修正する**

```typescript
// app/page.tsx
import Hero            from '@/components/home/Hero'
import Experience      from '@/components/home/Experience'
import Facilities      from '@/components/home/Facilities'
import Plan            from '@/components/home/Plan'
import Rules           from '@/components/home/Rules'
import BookingCalendar from '@/components/home/BookingCalendar'
import Access          from '@/components/home/Access'
import Contact         from '@/components/home/Contact'
import FaqSection      from '@/components/home/FaqSection'
import { supabaseAdmin } from '@/lib/supabase'

async function getPhotos(section: 'hero' | 'facilities') {
  const { data } = await supabaseAdmin
    .from('photos').select('id, url, caption')
    .eq('section', section).order('sort_order')
  return data ?? []
}

async function getFaqs() {
  const { data } = await supabaseAdmin
    .from('faqs').select('id, question, answer, category')
    .eq('is_published', true).order('category').order('sort_order')
  return data ?? []
}

export default async function HomePage() {
  const [heroPhotos, facilityPhotos, faqs] = await Promise.all([
    getPhotos('hero'),
    getPhotos('facilities'),
    getFaqs(),
  ])

  return (
    <main>
      <Hero photos={heroPhotos} />
      <Experience />
      <Facilities photos={facilityPhotos} />
      <Plan />
      <Rules />
      <section id="booking" className="py-20 px-4 bg-warm-100">
        <div className="max-w-sm mx-auto text-center">
          <h2 className="font-serif text-2xl md:text-3xl text-warm-600 mb-2">空き確認</h2>
          <p className="text-warm-400 mb-10 text-sm tracking-widest">BOOKING</p>
          <BookingCalendar />
        </div>
      </section>
      <Access />
      <FaqSection faqs={faqs} />
      <Contact />
      <footer className="bg-warm-700 text-warm-300 text-center py-6 text-xs">
        <p>© 2026 @blueSky. All rights reserved.</p>
        <p className="mt-1">滋賀県高島市安曇川町川島1478-5</p>
      </footer>
    </main>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add app/page.tsx
git commit -m "feat: home page fetches photos and FAQs from Supabase"
```

---

## Task 10: WeatherForecast コンポーネント + StepConfirm に組み込む

**Files:**
- Create: `components/reserve/WeatherForecast.tsx`
- Modify: `components/reserve/StepConfirm.tsx`

- [ ] **Step 1: WeatherForecast コンポーネントを作成する**

```typescript
// components/reserve/WeatherForecast.tsx
'use client'
import { useState, useEffect } from 'react'

interface Forecast {
  label:   string
  icon:    string
  tempMax: number
  tempMin: number
}

interface Props {
  date: string  // YYYY-MM-DD
}

export default function WeatherForecast({ date }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch(`/api/weather?date=${date}`)
      .then(r => r.json())
      .then(d => { setForecast(d.forecast ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [date])

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-warm-400 animate-pulse">
      <span>🌡️</span><span>天気予報を取得中...</span>
    </div>
  )

  if (!forecast) return null

  return (
    <div className="flex items-center gap-3 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 text-sm">
      <span className="text-2xl">{forecast.icon}</span>
      <div>
        <p className="text-warm-600 font-medium">チェックイン日の天気予報</p>
        <p className="text-warm-500 text-xs">
          {forecast.label}　最高 {forecast.tempMax}℃ / 最低 {forecast.tempMin}℃
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: StepConfirm.tsx に WeatherForecast を追加する**

```typescript
// components/reserve/StepConfirm.tsx
'use client'
import { useState, useEffect } from 'react'
import { calcBreakdown, calcTotal } from '@/lib/pricing'
import WeatherForecast from '@/components/reserve/WeatherForecast'
import type { ReservationFormData, PricingItem } from '@/types/reservation'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props { form: ReservationFormData; onNext: () => void; onBack: () => void }

export default function StepConfirm({ form, onNext, onBack }: Props) {
  const [pricing, setPricing] = useState<PricingItem[]>([])
  useEffect(() => {
    fetch('/api/pricing').then(r => r.json()).then(d => setPricing(d.pricing ?? []))
  }, [])

  const breakdown = calcBreakdown(form, pricing)
  const total     = calcTotal(form, pricing)

  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">内容確認</h3>
      <div className="bg-warm-50 rounded-xl p-5 space-y-2 text-sm mb-6">
        {([
          ['チェックイン',   form.checkinDate],
          ['チェックアウト', form.checkoutDate],
          ['宿泊タイプ',     (form.stayTypes ?? []).map(t => STAY_LABELS[t]).join('・') || '未選択'],
          ['お名前',         form.guestName],
          ['メール',         form.guestEmail],
          ['電話番号',       form.guestPhone],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-warm-400">{label}</span>
            <span className="text-warm-600 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* チェックイン日の天気予報 */}
      {form.checkinDate && (
        <div className="mb-6">
          <WeatherForecast date={form.checkinDate} />
        </div>
      )}

      <div className="bg-white border border-warm-200 rounded-xl p-5 mb-6">
        <h4 className="font-bold text-warm-600 mb-3 text-sm">料金明細</h4>
        {breakdown.map((b, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b border-warm-100 last:border-0">
            <span className="text-warm-500">{b.label}</span>
            <span className="text-warm-600">¥{b.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-warm-700 mt-3 pt-3 border-t border-warm-200">
          <span>合計</span>
          <span className="text-lg">¥{total.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={onNext} className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-3 rounded-lg transition-colors text-base">決済へ進む →</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: コミット**

```bash
git add components/reserve/WeatherForecast.tsx components/reserve/StepConfirm.tsx
git commit -m "feat: add weather forecast to reservation confirmation step"
```

---

## Task 11: 予約確認メールに天気予報を追加する

**Files:**
- Modify: `emails/ReservationConfirm.tsx`
- Modify: `lib/email.ts`

- [ ] **Step 1: ReservationConfirm.tsx に天気 props を追加する**

既存ファイルの `Props` インターフェースと本文に追加する。

```typescript
// emails/ReservationConfirm.tsx
// （既存コードの Props インターフェースに以下を追加）

interface Props {
  reservationId:   string
  guestName:       string
  checkinDate:     string
  checkoutDate:    string
  stayTypes:       string[]
  sauna:           boolean
  pet:             boolean
  ehu:             boolean
  transferCount:   number
  transferStation: string | null
  totalAmount:     number
  siteUrl:         string
  status:          'pending' | 'confirmed'
  weatherIcon?:    string   // 追加
  weatherLabel?:   string   // 追加
  weatherTempMax?: number   // 追加
  weatherTempMin?: number   // 追加
}
```

`export default function ReservationConfirm(...)` の props を同様に更新し、
`<Hr style={divider} />` の直後（合計金額の前）に以下を追加する：

```typescript
// キャンセルポリシーの Section の直前に挿入
{weatherLabel && (
  <Section style={weatherBox}>
    <Text style={policyTitle}>チェックイン日の天気予報</Text>
    <Text style={{ ...policyText, fontSize: '14px' }}>
      {weatherIcon} {weatherLabel}　最高 {weatherTempMax}℃ / 最低 {weatherTempMin}℃
    </Text>
  </Section>
)}
```

styles に以下を追加：

```typescript
const weatherBox: React.CSSProperties = {
  backgroundColor: '#e0f2fe',
  borderLeft: '3px solid #38bdf8',
  padding: '12px 16px',
  marginTop: '24px',
}
```

- [ ] **Step 2: lib/email.ts を更新して天気データを渡す**

```typescript
// lib/email.ts の sendReservationEmails 関数を修正

import { getWeatherForecast } from '@/lib/weather'

export async function sendReservationEmails(
  r: ReservationEmailData,
  status: 'pending' | 'confirmed' = 'pending',
): Promise<void> {
  const stayTypes = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId   = r.id.slice(0, 8).toUpperCase()
  const subject   = status === 'confirmed'
    ? `【@blueSky】ご予約確認 - ${shortId}`
    : `【@blueSky】ご予約受付 - ${shortId}`

  // 天気予報取得（失敗しても続行）
  const weather = await getWeatherForecast(r.checkin_date).catch(() => null)

  const weatherProps = weather ? {
    weatherIcon:    weather.icon,
    weatherLabel:   weather.label,
    weatherTempMax: weather.tempMax,
    weatherTempMin: weather.tempMin,
  } : {}

  const [guestHtml, ownerHtml] = await Promise.all([
    render(ReservationConfirm({
      reservationId:   r.id,
      guestName:       r.guest_name,
      checkinDate:     r.checkin_date,
      checkoutDate:    r.checkout_date,
      stayTypes,
      sauna:           r.sauna,
      pet:             r.pet,
      ehu:             r.ehu,
      transferCount:   r.transfer_count,
      transferStation: r.transfer_station,
      totalAmount:     r.total_amount,
      siteUrl:         SITE,
      status,
      ...weatherProps,
    })),
    render(ReservationNotify({
      reservationId:   r.id,
      guestName:       r.guest_name,
      guestEmail:      r.guest_email,
      guestPhone:      r.guest_phone,
      checkinDate:     r.checkin_date,
      checkoutDate:    r.checkout_date,
      stayTypes,
      sauna:           r.sauna,
      pet:             r.pet,
      ehu:             r.ehu,
      transferCount:   r.transfer_count,
      transferStation: r.transfer_station,
      totalAmount:     r.total_amount,
      adminUrl:        ADMIN_URL,
    })),
  ])

  await Promise.all([
    resend.emails.send({ from: FROM, to: r.guest_email, subject, html: guestHtml }),
    resend.emails.send({ from: FROM, to: OWNER, subject: `【新規予約】${shortId} - ${r.guest_name} 様`, html: ownerHtml }),
  ])
}
```

- [ ] **Step 3: コミット**

```bash
git add emails/ReservationConfirm.tsx lib/email.ts
git commit -m "feat: add weather forecast to reservation confirmation email"
```

---

## Task 12: 管理画面 - 写真管理ページ

**Files:**
- Create: `components/admin/PhotoManager.tsx`
- Create: `app/admin/(dashboard)/photos/page.tsx`

- [ ] **Step 1: PhotoManager コンポーネントを作成する**

```typescript
// components/admin/PhotoManager.tsx
'use client'
import { useState, useRef } from 'react'

interface Photo {
  id:         string
  url:        string
  caption:    string | null
  section:    string
  sort_order: number
}

interface Props {
  initialPhotos: Photo[]
}

export default function PhotoManager({ initialPhotos }: Props) {
  const [photos,     setPhotos]     = useState<Photo[]>(initialPhotos)
  const [uploading,  setUploading]  = useState(false)
  const [section,    setSection]    = useState<'hero' | 'facilities'>('hero')
  const [caption,    setCaption]    = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const heroPhotos       = photos.filter(p => p.section === 'hero')
  const facilityPhotos   = photos.filter(p => p.section === 'facilities')

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file',    file)
    fd.append('section', section)
    if (caption) fd.append('caption', caption)

    const res = await fetch('/api/admin/photos', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'アップロード失敗'); setUploading(false); return }

    setPhotos(prev => [...prev, data.photo])
    setCaption('')
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この写真を削除しますか？')) return
    await fetch(`/api/admin/photos/${id}`, { method: 'DELETE' })
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  const handleMove = async (id: string, direction: 'up' | 'down', section: string) => {
    const sectionPhotos = photos.filter(p => p.section === section).sort((a, b) => a.sort_order - b.sort_order)
    const idx = sectionPhotos.findIndex(p => p.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sectionPhotos.length) return

    const a = sectionPhotos[idx]
    const b = sectionPhotos[swapIdx]
    await Promise.all([
      fetch(`/api/admin/photos/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`/api/admin/photos/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ])
    setPhotos(prev => prev.map(p =>
      p.id === a.id ? { ...p, sort_order: b.sort_order } :
      p.id === b.id ? { ...p, sort_order: a.sort_order } : p
    ))
  }

  const PhotoGrid = ({ items, sectionKey }: { items: Photo[], sectionKey: string }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
      {items.sort((a, b) => a.sort_order - b.sort_order).map((photo, i) => (
        <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-warm-200 bg-warm-50">
          <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-32 object-cover" />
          <div className="p-2">
            <p className="text-xs text-warm-500 truncate">{photo.caption ?? '(キャプションなし)'}</p>
            <div className="flex gap-1 mt-1">
              <button onClick={() => handleMove(photo.id, 'up', sectionKey)}
                      className="text-xs text-warm-400 hover:text-warm-600 border border-warm-200 px-1 rounded" disabled={i === 0}>↑</button>
              <button onClick={() => handleMove(photo.id, 'down', sectionKey)}
                      className="text-xs text-warm-400 hover:text-warm-600 border border-warm-200 px-1 rounded" disabled={i === items.length - 1}>↓</button>
              <button onClick={() => handleDelete(photo.id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-1 rounded ml-auto">削除</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* アップロードフォーム */}
      <div className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-bold text-warm-700 mb-4">写真をアップロード</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-warm-400 mb-1">セクション</label>
            <select value={section} onChange={e => setSection(e.target.value as 'hero' | 'facilities')}
                    className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400">
              <option value="hero">Hero（トップ背景）</option>
              <option value="facilities">設備紹介</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">キャプション（任意）</label>
            <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
                   placeholder="写真の説明..."
                   className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400 w-48" />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">ファイル</label>
            <input ref={fileRef} type="file" accept="image/*"
                   className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white" />
          </div>
          <button onClick={handleUpload} disabled={uploading}
                  className="bg-warm-300 hover:bg-warm-400 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {uploading ? 'アップロード中...' : 'アップロード'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* Hero 写真一覧 */}
      <div>
        <h3 className="font-bold text-warm-700 mb-1">Hero（トップ背景）— {heroPhotos.length}枚</h3>
        <p className="text-xs text-warm-400 mb-2">写真が0枚の場合はデフォルト画像が表示されます</p>
        {heroPhotos.length === 0
          ? <p className="text-warm-400 text-sm bg-warm-50 rounded-xl p-4 text-center">写真がありません</p>
          : <PhotoGrid items={heroPhotos} sectionKey="hero" />}
      </div>

      {/* Facilities 写真一覧 */}
      <div>
        <h3 className="font-bold text-warm-700 mb-1">設備紹介 — {facilityPhotos.length}枚</h3>
        {facilityPhotos.length === 0
          ? <p className="text-warm-400 text-sm bg-warm-50 rounded-xl p-4 text-center">写真がありません</p>
          : <PhotoGrid items={facilityPhotos} sectionKey="facilities" />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 写真管理ページを作成する**

```typescript
// app/admin/(dashboard)/photos/page.tsx
import { supabaseAdmin } from '@/lib/supabase'
import PhotoManager from '@/components/admin/PhotoManager'

export const metadata = { title: '写真管理 | @blueSky 管理' }

export default async function PhotosPage() {
  const { data } = await supabaseAdmin
    .from('photos').select('*').order('section').order('sort_order')

  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">写真管理</h1>
      <PhotoManager initialPhotos={data ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: コミット**

```bash
git add components/admin/PhotoManager.tsx app/admin/(dashboard)/photos/page.tsx
git commit -m "feat: add admin photo management page"
```

---

## Task 13: 管理画面 - FAQ管理ページ

**Files:**
- Create: `components/admin/FaqManager.tsx`
- Create: `app/admin/(dashboard)/faqs/page.tsx`

- [ ] **Step 1: FaqManager コンポーネントを作成する**

```typescript
// components/admin/FaqManager.tsx
'use client'
import { useState } from 'react'

const CATEGORIES = [
  { value: 'general',  label: 'よくある質問' },
  { value: 'pricing',  label: '料金について' },
  { value: 'access',   label: 'アクセス・送迎' },
  { value: 'facility', label: '設備・施設' },
]

interface Faq {
  id:           string
  question:     string
  answer:       string
  category:     string
  sort_order:   number
  is_published: boolean
}

const EMPTY: Omit<Faq, 'id'> = {
  question: '', answer: '', category: 'general', sort_order: 0, is_published: true,
}

export default function FaqManager({ initialFaqs }: { initialFaqs: Faq[] }) {
  const [faqs,    setFaqs]    = useState<Faq[]>(initialFaqs)
  const [form,    setForm]    = useState<Omit<Faq, 'id'>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)

    if (editing) {
      await fetch(`/api/admin/faqs/${editing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setFaqs(prev => prev.map(f => f.id === editing ? { ...f, ...form } : f))
      setEditing(null)
    } else {
      const res  = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sort_order: faqs.length }),
      })
      const data = await res.json()
      if (res.ok) setFaqs(prev => [...prev, data.faq])
    }

    setForm(EMPTY)
    setSaving(false)
  }

  const handleEdit = (faq: Faq) => {
    setEditing(faq.id)
    setForm({ question: faq.question, answer: faq.answer, category: faq.category,
              sort_order: faq.sort_order, is_published: faq.is_published })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このFAQを削除しますか？')) return
    await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE' })
    setFaqs(prev => prev.filter(f => f.id !== id))
  }

  const handleTogglePublish = async (faq: Faq) => {
    await fetch(`/api/admin/faqs/${faq.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !faq.is_published }),
    })
    setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, is_published: !f.is_published } : f))
  }

  return (
    <div className="space-y-6">
      {/* 追加・編集フォーム */}
      <div className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-bold text-warm-700 mb-4">{editing ? 'FAQ を編集' : '新しい FAQ を追加'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-warm-400 mb-1">カテゴリ</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">質問</label>
            <input type="text" value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                   placeholder="質問を入力..."
                   className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400" />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">回答</label>
            <textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                      rows={3} placeholder="回答を入力..."
                      className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.question || !form.answer}
                    className="bg-warm-300 hover:bg-warm-400 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? '保存中...' : editing ? '更新する' : '追加する'}
            </button>
            {editing && (
              <button onClick={() => { setEditing(null); setForm(EMPTY) }}
                      className="border border-warm-200 text-warm-500 px-4 py-2 rounded-lg text-sm">
                キャンセル
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FAQ一覧 */}
      <div className="overflow-x-auto rounded-xl border border-warm-200">
        <table className="w-full text-sm">
          <thead className="bg-warm-100 text-warm-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">質問</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">カテゴリ</th>
              <th className="px-4 py-3 text-center font-medium">公開</th>
              <th className="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map(faq => (
              <tr key={faq.id} className="border-t border-warm-100 hover:bg-warm-50">
                <td className="px-4 py-3 text-warm-700 max-w-xs truncate">{faq.question}</td>
                <td className="px-4 py-3 text-warm-500 hidden md:table-cell">
                  {CATEGORIES.find(c => c.value === faq.category)?.label}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleTogglePublish(faq)}
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            faq.is_published ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-400'
                          }`}>
                    {faq.is_published ? '公開' : '非公開'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEdit(faq)}
                          className="text-xs text-warm-500 hover:text-warm-700 border border-warm-200 px-2 py-1 rounded mr-1">
                    編集
                  </button>
                  <button onClick={() => handleDelete(faq.id)}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded">
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {faqs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-warm-400">FAQがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: FAQ管理ページを作成する**

```typescript
// app/admin/(dashboard)/faqs/page.tsx
import { supabaseAdmin } from '@/lib/supabase'
import FaqManager from '@/components/admin/FaqManager'

export const metadata = { title: 'FAQ管理 | @blueSky 管理' }

export default async function FaqsPage() {
  const { data } = await supabaseAdmin
    .from('faqs').select('*').order('category').order('sort_order')

  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">FAQ管理</h1>
      <FaqManager initialFaqs={data ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: コミット**

```bash
git add components/admin/FaqManager.tsx app/admin/(dashboard)/faqs/page.tsx
git commit -m "feat: add admin FAQ management page"
```

---

## Task 14: 管理画面ナビに写真・FAQを追加 + デプロイ

**Files:**
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: layout.tsx にナビ項目を追加する**

```typescript
// app/admin/(dashboard)/layout.tsx の nav 配列を以下に差し替える
{[
  { href: '/admin',               label: '📅 予約カレンダー' },
  { href: '/admin/reservations',  label: '📋 予約一覧' },
  { href: '/admin/pricing',       label: '💴 料金設定' },
  { href: '/admin/rental-items',  label: '🎒 レンタル管理' },
  { href: '/admin/blocked-dates', label: '🚫 日程ブロック' },
  { href: '/admin/photos',        label: '📸 写真管理' },
  { href: '/admin/faqs',          label: '❓ FAQ管理' },
].map(item => (
  <Link key={item.href} href={item.href}
        className="block px-5 py-2.5 text-sm hover:bg-warm-600 transition-colors">
    {item.label}
  </Link>
))}
```

- [ ] **Step 2: 全テストを実行する**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npx vitest run
```

Expected: PASS (既存 31 tests + 新規 weather 6 tests = 37 tests)

- [ ] **Step 3: ビルド確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npx next build 2>&1
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: コミット**

```bash
git add app/admin/(dashboard)/layout.tsx
git commit -m "feat: add photos and FAQs to admin navigation"
```

- [ ] **Step 5: GitHub push + Vercel デプロイ**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
git push origin main
npx vercel --prod --yes
```

Expected: `Aliased: https://bluesky-camp.vercel.app`

---

## 動作確認チェックリスト

- [ ] `/admin/photos` で写真をアップロードできる
- [ ] Hero セクションにアップロードした写真がスライドショー表示される（写真0枚時は既存デザイン）
- [ ] Facilities セクションにスライドショーが表示される
- [ ] `/admin/faqs` で FAQ を追加・編集・削除・公開切り替えできる
- [ ] トップページ下部に FAQ アコーディオンが表示される
- [ ] 予約確認画面（StepConfirm）にチェックイン日の天気が表示される
- [ ] 予約確認メールに天気情報が含まれる
- [ ] 天気 API 失敗時は天気欄が非表示になる（エラーが出ない）
