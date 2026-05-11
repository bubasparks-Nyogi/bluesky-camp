import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  const { name, email, message } = await req.json()
  if (!name || !email || !message) {
    return NextResponse.json({ error: '全項目を入力してください' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL!,
    to:      process.env.OWNER_EMAIL!,
    subject: `【@blueSky お問い合わせ】${name} 様`,
    html:    `<p>名前: ${name}</p><p>メール: ${email}</p><p>内容:<br>${message.replace(/\n/g, '<br>')}</p>`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
