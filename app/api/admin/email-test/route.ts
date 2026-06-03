import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// 一時的なメール診断エンドポイント（admin認証必須）。問題解決後に削除する。
export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const owner = process.env.OWNER_EMAIL

  const diag: Record<string, unknown> = {
    GMAIL_USER_set: !!user,
    GMAIL_USER_value: user ?? null,
    GMAIL_APP_PASSWORD_set: !!pass,
    GMAIL_APP_PASSWORD_len: pass ? pass.length : 0,
    GMAIL_APP_PASSWORD_hasSpace: pass ? /\s/.test(pass) : null,
    OWNER_EMAIL: owner ?? null,
  }

  if (!user || !pass) {
    return NextResponse.json({ stage: 'env', ok: false, diag })
  }

  try {
    const tx = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user, pass },
    })
    await tx.verify()
    const info = await tx.sendMail({
      from: `"@blueSky" <${user}>`,
      to: owner ?? user,
      subject: '【診断】メール送信テスト',
      html: '<p>これはメール送信の診断テストです。届けば設定は正常です。</p>',
    })
    return NextResponse.json({ stage: 'sent', ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, diag })
  } catch (e) {
    return NextResponse.json({
      stage: 'send', ok: false,
      error: e instanceof Error ? e.message : String(e),
      code: (e as { code?: string })?.code ?? null,
      diag,
    })
  }
}
