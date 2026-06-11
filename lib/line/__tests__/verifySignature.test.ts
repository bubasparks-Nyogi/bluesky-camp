import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { verifySignature } from '../verifySignature'

const SECRET = 'test-channel-secret'
const BODY = JSON.stringify({ events: [{ type: 'message' }] })

function sign(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64')
}

describe('verifySignature', () => {
  it('returns true for a valid signature', () => {
    const sig = sign(BODY, SECRET)
    expect(verifySignature(BODY, sig, SECRET)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const sig = sign(BODY, SECRET)
    const tampered = BODY + ' '
    expect(verifySignature(tampered, sig, SECRET)).toBe(false)
  })

  it('returns false for a signature from a different secret', () => {
    const sig = sign(BODY, 'other-secret')
    expect(verifySignature(BODY, sig, SECRET)).toBe(false)
  })

  it('returns false for an empty signature header', () => {
    expect(verifySignature(BODY, '', SECRET)).toBe(false)
  })

  it('returns false for an empty body', () => {
    const sig = sign('', SECRET)
    expect(verifySignature('', sig, SECRET)).toBe(true)
    expect(verifySignature(BODY, sig, SECRET)).toBe(false)
  })

  it('uses constant-time comparison (does not throw on length mismatch)', () => {
    expect(() => verifySignature(BODY, 'abc', SECRET)).not.toThrow()
    expect(verifySignature(BODY, 'abc', SECRET)).toBe(false)
  })
})
