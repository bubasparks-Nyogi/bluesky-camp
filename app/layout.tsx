import type { Metadata, Viewport } from 'next'
import { Noto_Serif_JP, Noto_Sans_JP } from 'next/font/google'
import './globals.css'
import JsonLd from '@/components/JsonLd'
import AuthNav from '@/components/AuthNav'
import { SITE_URL } from '@/lib/seo-constants'

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
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '@blueSky',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#a16745',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSerif.variable} ${notoSans.variable}`}>
      <body className="font-sans bg-warm-50 text-warm-700">
        <JsonLd />
        <div className="fixed top-4 right-4 z-50">
          <AuthNav />
        </div>
        {children}
      </body>
    </html>
  )
}
