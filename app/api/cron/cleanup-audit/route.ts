import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * N-8: audit_logs と receipt_lookup_attempts の自動ローテーション。
 * Vercel Cron から日次で起動される（CRON_SECRET で認証）。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const oneYearAgo  = new Date(now - 365 * 86400_000).toISOString()
  const thirtyDays  = new Date(now -  30 * 86400_000).toISOString()

  const audit = await supabaseAdmin
    .from('audit_logs').delete().lt('created_at', oneYearAgo).select('id')
  const lookup = await supabaseAdmin
    .from('receipt_lookup_attempts').delete().lt('attempted_at', thirtyDays).select('id')

  return NextResponse.json({
    ok: true,
    deletedAuditLogs: audit.data?.length ?? 0,
    deletedLookupAttempts: lookup.data?.length ?? 0,
  })
}
