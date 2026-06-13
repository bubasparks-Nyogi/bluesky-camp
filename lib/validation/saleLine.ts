import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const saleLineCreateSchema = z.object({
  itemId:     z.string().uuid('itemId が UUID 形式ではありません'),
  quantity:   z.number().positive('数量は正の数である必要があります').max(10000),
  occurredAt: z.string().regex(dateRegex, '発生日の形式が不正です（YYYY-MM-DD）'),
  note:       z.string().max(200).optional().nullable(),
})

export type SaleLineCreateInput = z.infer<typeof saleLineCreateSchema>
