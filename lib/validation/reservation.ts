import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const phoneRegex = /^[0-9+\-() ]{8,20}$/

export const stayTypeSchema = z.enum(['tent', 'trailer_a', 'trailer_b', 'campervan'])

export const rentalItemSchema = z.object({
  id:    z.string().min(1, 'レンタル品ID が空です'),
  name:  z.string().min(1),
  price: z.number().int().nonnegative(),
  qty:   z.number().int().positive(),
})

export const reservationFormSchema = z.object({
  checkinDate:     z.string().regex(dateRegex, 'チェックイン日付の形式が不正です'),
  checkoutDate:    z.string().regex(dateRegex, 'チェックアウト日付の形式が不正です'),
  stayTypes:       z.array(stayTypeSchema).min(1, '宿泊タイプを選択してください'),
  ehu:             z.boolean(),
  sauna:           z.boolean(),
  pet:             z.boolean(),
  transferCount:   z.number().int().min(0).max(20),
  transferStation: z.string().max(100),
  rentalItems:     z.array(rentalItemSchema).max(50),
  guestName:       z.string().trim().min(1, 'お名前を入力してください').max(80),
  guestEmail:      z.string().trim().email('メールアドレスの形式が不正です').max(120),
  guestPhone:      z.string().trim().regex(phoneRegex, '電話番号の形式が不正です'),
}).refine(v => v.checkoutDate > v.checkinDate, {
  message: 'チェックアウト日はチェックイン日より後である必要があります',
  path: ['checkoutDate'],
})

export type ReservationFormInput = z.infer<typeof reservationFormSchema>
