import { SITE_URL } from '@/lib/seo-constants'

export const localBusiness = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  name: '@blueSky',
  description: '忙しい日常から非日常へ。滋賀県高島市の一日一組限定キャンプ場。焚き火・サウナ・ドラム缶風呂。完全貸切でプライベートな時間を。',
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
