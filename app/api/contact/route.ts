import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/mailer'
import { contactFormSchema, escapeHtml } from '@/lib/validation/contact'
import { memoryRateLimit } from '@/lib/security/rateLimit'

export async function POST(req: NextRequest) {
  // N-2: レート制限（同一IP 30分5回まで）
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (memoryRateLimit(`contact:${ip}`, 30 * 60 * 1000, 5)) {
    return NextResponse.json(
      { error: '短時間に多数のお問い合わせを受信しました。時間をおいて再度お試しください。' },
      { status: 429 },
    )
  }

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const parsed = contactFormSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first?.message ?? '入力内容を確認してください', field: first?.path.join('.') },
      { status: 400 },
    )
  }
  const { name, email, message } = parsed.data

  // N-2: HTML エスケープしてからメール本文に埋め込み
  const safeName    = escapeHtml(name)
  const safeEmail   = escapeHtml(email)
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>')

  await sendMail({
    to:      process.env.OWNER_EMAIL!,
    subject: `【@blueSky お問い合わせ】${safeName} 様`,
    html:    `<p>名前: ${safeName}</p><p>メール: ${safeEmail}</p><p>内容:<br>${safeMessage}</p>`,
  })

  return NextResponse.json({ ok: true })
}
