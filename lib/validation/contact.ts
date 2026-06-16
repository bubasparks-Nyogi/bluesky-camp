import { z } from 'zod'

export const contactFormSchema = z.object({
  name:    z.string().trim().min(1, 'お名前を入力してください').max(80),
  email:   z.string().trim().email('メールアドレスの形式が不正です').max(120),
  message: z.string().trim().min(1, 'メッセージを入力してください').max(2000),
})

export type ContactFormInput = z.infer<typeof contactFormSchema>

/** HTML エスケープ（XSS 対策）*/
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
