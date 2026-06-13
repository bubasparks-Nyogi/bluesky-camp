export type ValidateApproveResult =
  | { ok: true }
  | { ok: false; httpStatus: 400 | 409; message: string }

export function validateApprove(draft: { status: string; item_id: string | null }): ValidateApproveResult {
  if (draft.status !== 'pending')
    return { ok: false, httpStatus: 409, message: 'すでに承認/拒否済みです' }
  if (!draft.item_id)
    return { ok: false, httpStatus: 400, message: '商品を選択してください' }
  return { ok: true }
}
