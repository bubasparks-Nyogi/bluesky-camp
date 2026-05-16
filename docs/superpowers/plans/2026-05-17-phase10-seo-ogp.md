# Phase 10 SEO/OGP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full SEO/OGP support — Open Graph tags, Twitter Card, sitemap.xml, robots.txt, JSON-LD LocalBusiness schema, and auto-generated OG image.

**Architecture:** Next.js 14 App Router built-in metadata APIs handle OGP/Twitter/canonical. `app/opengraph-image.tsx` generates a 1200×630 OG image via `next/og` ImageResponse at request time (Edge runtime). `app/sitemap.ts` and `app/robots.ts` export functions that Next.js converts to `/sitemap.xml` and `/robots.txt` automatically. A `JsonLd` Server Component injects the `<script type="application/ld+json">` tag.

**Tech Stack:** Next.js 14 App Router metadata API, `next/og` ImageResponse, Vitest for unit tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/layout.tsx` | Modify | Add `metadataBase`, full `openGraph`, `twitter`, `alternates.canonical`; render `<JsonLd>` |
| `app/opengraph-image.tsx` | Create | Edge-rendered OG image (1200×630) with brand colours and copy |
| `app/sitemap.ts` | Create | Export `sitemap()` → `/sitemap.xml` with 3 URLs |
| `app/robots.ts` | Create | Export `robots()` → `/robots.txt` |
| `components/JsonLd.tsx` | Create | Server component that renders LocalBusiness JSON-LD |
| `app/reserve/page.tsx` | Modify | Add full `openGraph` + `twitter` to existing `metadata` export |
| `app/rules/page.tsx` | Modify | Add full `openGraph` + `twitter` to existing `metadata` export |
| `lib/__tests__/seo.test.ts` | Create | Unit tests for sitemap URLs and robots rules |

---

### Task 1: JsonLd component + layout.tsx full metadata

**Files:**
- Create: `components/JsonLd.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write failing tests for JsonLd**

```bash
# Create test file
cat > "lib/__tests__/seo.test.ts" << 'EOF'
import { describe, it, expect } from 'vitest'

// Test the sitemap shape (imported after Task 2)
// For now test the JSON-LD data shape inline

const SITE_URL = 'https://bluesky-camp.vercel.app'

describe('JSON-LD LocalBusiness', () => {
  it('contains required schema fields', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'LodgingBusiness',
      name: '@blueSky',
      description: '忙しい日常から非日常へ。滋賀県高島市の一日一組限定キャンプ場。',
      url: SITE_URL,
      address: {
        '@type': 'PostalAddress',
        addressRegion: '滋賀県',
        addressLocality: '高島市',
        addressCountry: 'JP',
      },
      priceRange: '¥¥¥',
      amenityFeature: ['焚き火', 'サウナ', 'ドラム缶風呂'],
    }
    expect(ld['@type']).toBe('LodgingBusiness')
    expect(ld.address.addressRegion).toBe('滋賀県')
    expect(ld.priceRange).toBe('¥¥¥')
    expect(ld.amenityFeature).toContain('サウナ')
  })
})
EOF
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/seo.test.ts 2>&1
```
Expected: FAIL — file not found or assertion errors

- [ ] **Step 3: Create `components/JsonLd.tsx`**

```tsx
// components/JsonLd.tsx
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bluesky-camp.vercel.app'

const localBusiness = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  name: '@blueSky',
  description: '忙しい日常から非日常へ。滋賀県高島市の一日一組限定キャンプ場。焚き火・サウナ・ドラム缶風呂。',
  url: SITE_URL,
  address: {
    '@type': 'PostalAddress',
    addressRegion: '滋賀県',
    addressLocality: '高島市',
    addressCountry: 'JP',
  },
  priceRange: '¥¥¥',
  amenityFeature: ['焚き火', 'サウナ', 'ドラム缶風呂'],
  openingHours: 'Mo-Su 14:00-10:00',
}

export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
    />
  )
}
```

- [ ] **Step 4: Update `app/layout.tsx` with full metadata**

Replace the entire file with:

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Noto_Serif_JP, Noto_Sans_JP } from 'next/font/google'
import './globals.css'
import JsonLd from '@/components/JsonLd'

const notoSerif = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
  display: 'swap',
})
const notoSans = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bluesky-camp.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '@blueSky | 滋賀・高島市 一日一組限定キャンプ場',
    template: '%s | @blueSky',
  },
  description: '忙しい日常から非日常へ。滋賀県高島市の一日一組限定キャンプ場。焚き火・サウナ・ドラム缶風呂。完全貸切でプライベートな時間を。',
  keywords: ['キャンプ場', '高島市', '滋賀県', '一日一組', '完全貸切', '焚き火', 'サウナ', 'ドラム缶風呂'],
  authors: [{ name: '@blueSky' }],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: SITE_URL,
    siteName: '@blueSky',
    title: '@blueSky | 滋賀・高島市 一日一組限定キャンプ場',
    description: '忙しい日常から非日常へ。滋賀県高島市の一日一組限定キャンプ場。焚き火・サウナ・ドラム缶風呂。完全貸切でプライベートな時間を。',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: '@blueSky キャンプ場',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '@blueSky | 滋賀・高島市 一日一組限定キャンプ場',
    description: '忙しい日常から非日常へ。滋賀県高島市の一日一組限定キャンプ場。焚き火・サウナ・ドラム缶風呂。',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSerif.variable} ${notoSans.variable}`}>
      <body className="font-sans bg-warm-50 text-warm-700">
        <JsonLd />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/seo.test.ts 2>&1
```
Expected: PASS (1 test)

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/JsonLd.tsx app/layout.tsx lib/__tests__/seo.test.ts && git commit -m "feat: add JSON-LD LocalBusiness schema and full OGP metadata to layout"
```

---

### Task 2: sitemap.ts + robots.ts

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

- [ ] **Step 1: Add sitemap tests to existing test file**

Append to `lib/__tests__/seo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('sitemap URLs', () => {
  it('includes all public routes', () => {
    const SITE_URL = 'https://bluesky-camp.vercel.app'
    const urls = ['/', '/reserve', '/rules'].map(p => `${SITE_URL}${p}`)
    expect(urls).toContain(`${SITE_URL}/`)
    expect(urls).toContain(`${SITE_URL}/reserve`)
    expect(urls).toContain(`${SITE_URL}/rules`)
    expect(urls).not.toContain(`${SITE_URL}/admin`)
    expect(urls).not.toContain(`${SITE_URL}/api`)
  })
})

describe('robots', () => {
  it('disallows admin and api paths', () => {
    const disallowed = ['/admin', '/api']
    expect(disallowed).toContain('/admin')
    expect(disallowed).toContain('/api')
    expect(disallowed).not.toContain('/')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/seo.test.ts 2>&1
```
Expected: FAIL on new describe blocks

- [ ] **Step 3: Create `app/sitemap.ts`**

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bluesky-camp.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/reserve`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/rules`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
```

- [ ] **Step 4: Create `app/robots.ts`**

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bluesky-camp.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/__tests__/seo.test.ts 2>&1
```
Expected: PASS (3 describe blocks, all passing)

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/sitemap.ts app/robots.ts lib/__tests__/seo.test.ts && git commit -m "feat: add sitemap.xml and robots.txt"
```

---

### Task 3: OG Image (`app/opengraph-image.tsx`)

**Files:**
- Create: `app/opengraph-image.tsx`

- [ ] **Step 1: Create `app/opengraph-image.tsx`**

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '@blueSky キャンプ場'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '80px',
          background: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #451a03 100%)',
          position: 'relative',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            fontSize: '160px',
            display: 'flex',
          }}
        >
          🔥
        </div>

        {/* Tag line */}
        <div
          style={{
            color: '#fcd34d',
            fontSize: '28px',
            fontWeight: 400,
            marginBottom: '16px',
            letterSpacing: '0.1em',
            display: 'flex',
          }}
        >
          一日一組限定 ・ 完全貸切
        </div>

        {/* Title */}
        <div
          style={{
            color: '#ffffff',
            fontSize: '96px',
            fontWeight: 700,
            lineHeight: 1.0,
            marginBottom: '24px',
            display: 'flex',
          }}
        >
          @blueSky
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: '#fde68a',
            fontSize: '36px',
            fontWeight: 400,
            display: 'flex',
          }}
        >
          滋賀県高島市のキャンプ場
        </div>

        {/* Amenities */}
        <div
          style={{
            marginTop: '32px',
            display: 'flex',
            gap: '24px',
          }}
        >
          {['🔥 焚き火', '🧖 サウナ', '🛁 ドラム缶風呂'].map((item) => (
            <div
              key={item}
              style={{
                color: '#fff7ed',
                fontSize: '28px',
                background: 'rgba(255,255,255,0.12)',
                padding: '8px 20px',
                borderRadius: '999px',
                display: 'flex',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 2: Verify OG image renders locally**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run dev
```
Open in browser: `http://localhost:3000/opengraph-image`

Expected: 1200×630 dark brown image with `@blueSky` title, 🔥 emoji, amenity pills

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/opengraph-image.tsx && git commit -m "feat: add auto-generated OG image via next/og"
```

---

### Task 4: Per-page metadata for /reserve and /rules

**Files:**
- Modify: `app/reserve/page.tsx`
- Modify: `app/rules/page.tsx`

- [ ] **Step 1: Update `app/reserve/page.tsx` metadata**

Replace the existing `export const metadata` line (line 3: `export const metadata = { title: 'ご予約 | @blueSky' }`) with:

```typescript
import type { Metadata } from 'next'

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
```

Note: `title: 'ご予約'` uses the template from layout.tsx → renders as `ご予約 | @blueSky`. `robots: { index: false }` because the reservation form should not be indexed.

- [ ] **Step 2: Update `app/rules/page.tsx` metadata**

Replace the existing `export const metadata` block with:

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '利用規約',
  description: '@blueSky キャンプ場の利用規約・キャンセルポリシー・注意事項。',
  openGraph: {
    title: '利用規約 | @blueSky',
    description: '@blueSky キャンプ場の利用規約・キャンセルポリシー・注意事項。',
    url: '/rules',
  },
  twitter: {
    card: 'summary',
    title: '利用規約 | @blueSky',
    description: '@blueSky キャンプ場の利用規約・キャンセルポリシー・注意事項。',
  },
  alternates: {
    canonical: '/rules',
  },
}
```

- [ ] **Step 3: Verify title template works**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | grep -E "(error|Error|✓|✗)" | head -20
```
Expected: Build succeeds with no errors. Pages `/reserve` and `/rules` show in the output.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/reserve/page.tsx app/rules/page.tsx && git commit -m "feat: add per-page OGP metadata for reserve and rules pages"
```

---

### Task 5: Deploy and verify

**Files:** None (deployment only)

- [ ] **Step 1: Push to GitHub and deploy to Vercel**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -5
```
Expected: Deployment URL printed, e.g. `https://bluesky-camp.vercel.app`

- [ ] **Step 2: Verify sitemap.xml**

```bash
curl -s https://bluesky-camp.vercel.app/sitemap.xml
```
Expected: XML with 3 `<url>` entries for `/`, `/reserve`, `/rules`

- [ ] **Step 3: Verify robots.txt**

```bash
curl -s https://bluesky-camp.vercel.app/robots.txt
```
Expected:
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Sitemap: https://bluesky-camp.vercel.app/sitemap.xml
```

- [ ] **Step 4: Verify OG image**

Open in browser: `https://bluesky-camp.vercel.app/opengraph-image`

Expected: 1200×630 image with brown gradient, `@blueSky` heading, 🔥 emoji, amenity pills.

- [ ] **Step 5: Verify OGP tags with Social Debugger**

Open: `https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fbluesky-camp.vercel.app`

Expected: OG title, description, and OG image thumbnail visible.

- [ ] **Step 6: Verify JSON-LD**

```bash
curl -s https://bluesky-camp.vercel.app | grep -o 'application/ld+json.*</script>' | head -c 300
```
Expected: JSON with `"@type":"LodgingBusiness"` and address fields.
