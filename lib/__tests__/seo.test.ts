import { describe, it, expect } from 'vitest'

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
