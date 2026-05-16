import { describe, it, expect } from 'vitest'
import { localBusiness } from '@/components/JsonLd'

describe('JSON-LD LocalBusiness', () => {
  it('has correct @type', () => {
    expect(localBusiness['@type']).toBe('LodgingBusiness')
  })

  it('has correct address', () => {
    expect(localBusiness.address.addressRegion).toBe('滋賀県')
    expect(localBusiness.address.addressLocality).toBe('高島市')
    expect(localBusiness.address.addressCountry).toBe('JP')
  })

  it('has correct priceRange', () => {
    expect(localBusiness.priceRange).toBe('¥¥¥')
  })

  it('has amenity features', () => {
    const names = localBusiness.amenityFeature
    expect(names).toContain('サウナ')
    expect(names).toContain('焚き火')
    expect(names).toContain('ドラム缶風呂')
  })

  it('has openingHours', () => {
    expect(localBusiness.openingHours).toBeTruthy()
  })
})

describe('sitemap URLs', () => {
  it('includes all public routes and excludes admin/api', () => {
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
