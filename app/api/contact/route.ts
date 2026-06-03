import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json()
  if (!name || !email || !message) {
    return NextResponse.json({ error: '全項目を入力してください' }, { status: 400 })
  }

  await sendMail({
    to:      process.env.OWNER_EMAIL!,
    subject: `【@blueSky お問い合わせ】${name} 様`,
    html:    `<p>名前: ${name}</p><p>メール: ${email}</p><p>内容:<br>${message.replace(/\n/g, '<br>')}</p>`,
  })

  return NextResponse.json({ ok: true })
}
