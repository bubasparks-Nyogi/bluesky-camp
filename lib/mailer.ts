// lib/mailer.ts
import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD
const SENDER_NAME = '@blueSky'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!GMAIL_USER || !GMAIL_PASS) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    })
  }
  return transporter
}

/**
 * メールを送信する。GMAIL_USER / GMAIL_APP_PASSWORD 未設定なら
 * 送信せず警告ログのみ（best-effort: 呼び出し元の処理は止めない）。
 */
export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const tx = getTransporter()
  if (!tx || !GMAIL_USER) {
    console.warn('[mailer] GMAIL_USER / GMAIL_APP_PASSWORD 未設定のため送信をスキップしました:', opts.subject)
    return
  }
  await tx.sendMail({
    from: `"${SENDER_NAME}" <${GMAIL_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}
