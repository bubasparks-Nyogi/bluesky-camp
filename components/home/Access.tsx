import Link from 'next/link'

interface Props {
  address?: string
  phone?: string
  checkinTime?: string
  checkoutTime?: string
}

export default function Access({ address, phone, checkinTime, checkoutTime }: Props) {
  const addr = address || '滋賀県高島市安曇川町川島1478-5'
  const mapsQuery = encodeURIComponent(addr)
  const embedUrl  = `https://www.google.com/maps?q=${mapsQuery}&output=embed`

  return (
    <section id="access" className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">アクセス</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">ACCESS</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="rounded-2xl overflow-hidden shadow-md w-full aspect-video">
            <iframe
              src={embedUrl}
              width="100%" height="100%" style={{ border: 0 }}
              allowFullScreen loading="lazy" title="@blueSky アクセスマップ"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="space-y-4 text-sm text-warm-600">
            <div><p className="font-bold mb-1">住所</p><p>{addr}</p></div>
            {(checkinTime || checkoutTime) && (
              <div>
                <p className="font-bold mb-1">チェックイン / アウト</p>
                <p>
                  {checkinTime  && <>チェックイン {checkinTime}</>}
                  {checkinTime && checkoutTime && ' / '}
                  {checkoutTime && <>チェックアウト {checkoutTime}</>}
                </p>
              </div>
            )}
            {phone && (
              <div>
                <p className="font-bold mb-1">お問い合わせ</p>
                <p><a href={`tel:${phone.replace(/-/g, '')}`} className="text-warm-700 underline">{phone}</a></p>
              </div>
            )}
            <Link href="/access"
              className="inline-block mt-2 bg-warm-500 hover:bg-warm-600 text-white text-sm px-4 py-2 rounded-lg">
              詳しいアクセス案内 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
