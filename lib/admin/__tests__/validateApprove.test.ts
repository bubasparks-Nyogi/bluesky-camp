import { describe, it, expect } from 'vitest'
import { validateApprove } from '../validateApprove'

describe('validateApprove', () => {
  it('returns ok for pending + item_id set', () => {
    expect(validateApprove({ status: 'pending', item_id: 'itm-001' })).toEqual({ ok: true })
  })

  it('returns conflict error for non-pending status', () => {
    expect(validateApprove({ status: 'approved', item_id: 'itm-001' })).toEqual({
      ok: false, httpStatus: 409, message: 'すでに承認/拒否済みです',
    })
  })

  it('returns bad-request when item_id is null', () => {
    expect(validateApprove({ status: 'pending', item_id: null })).toEqual({
      ok: false, httpStatus: 400, message: '商品を選択してください',
    })
  })
})
