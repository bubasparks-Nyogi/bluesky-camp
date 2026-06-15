import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchSiteSettings } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'アクセス | @blueSky',
  description: '@blueSky キャンプ場へのアクセス・周辺案内',
}

export default async function AccessPage() {
  const s = await fetchSiteSettings()
  const mapsQuery = encodeURIComponent(s.address || '滋賀県高島市')
  const embedUrl  = `https://www.google.com/maps?q=${mapsQuery}&output=embed`
  const openUrl   = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  return (
    <main className="min-h-screen bg-warm-50">
      <header className="bg-warm-700 text-white py-4 px-6 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">アクセス</span>
      </header>

      <div className="max-w-3xl mx-auto p-4 lg:p-8 space-y-6">
        <section className="bg-white border border-warm-100 rounded-2xl p-5 space-y-3">
          <h1 className="font-serif text-2xl text-warm-700">📍 所在地</h1>
          {s.address ? (
            <>
              <p className="text-warm-700 text-lg">{s.address}</p>
              <a href={openUrl} target="_blank" rel="noopener noreferrer"
                className="inline-block bg-warm-500 hover:bg-warm-600 text-white text-sm px-4 py-2 rounded-lg">
                Google マップで開く ↗
              </a>
            </>
          ) : (
            <p className="text-warm-400 text-sm">準備中</p>
          )}
          {s.phone && (
            <p className="text-warm-500 text-sm">
              お問い合わせ:{' '}
              <a href={`tel:${s.phone.replace(/-/g, '')}`} className="text-warm-700 underline">{s.phone}</a>
            </p>
          )}
        </section>

        {s.address && (
          <section className="bg-white border border-warm-100 rounded-2xl overflow-hidden">
            <iframe
              src={embedUrl}
              title="Google Maps"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-80 lg:h-96 border-0"
              allowFullScreen
            />
          </section>
        )}

        {s.accessNote && (
          <section className="bg-white border border-warm-100 rounded-2xl p-5 space-y-2">
            <h2 className="font-serif text-xl text-warm-700">🚗 アクセス案内</h2>
            <p className="text-warm-700 whitespace-pre-wrap text-sm leading-relaxed">{s.accessNote}</p>
          </section>
        )}

        {(s.checkinTime || s.checkoutTime) && (
          <section className="bg-white border border-warm-100 rounded-2xl p-5 space-y-2">
            <h2 className="font-serif text-xl text-warm-700">🕒 ご利用時間</h2>
            {s.checkinTime  && <p className="text-warm-700 text-sm"><strong>チェックイン</strong>　{s.checkinTime}</p>}
            {s.checkoutTime && <p className="text-warm-700 text-sm"><strong>チェックアウト</strong>　{s.checkoutTime}</p>}
          </section>
        )}

        <div className="text-center pt-4">
          <Link href="/reserve"
            className="inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-6 py-3 rounded-lg">
            ご予約はこちら →
          </Link>
        </div>
      </div>
    </main>
  )
}
