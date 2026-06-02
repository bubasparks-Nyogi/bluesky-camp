import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = Number(req.nextUrl.searchParams.get('year')) || new Date().getFullYear()
  const { data, error } = await supabaseAdmin
    .from('opening_balances').select('*').eq('fiscal_year', year)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ openingBalances: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { fiscal_year, account_id, side, amount } = body
  if (!Number.isInteger(fiscal_year))  return NextResponse.json({ error: 'fiscal_year が必要です' }, { status: 400 })
  if (!account_id)                     return NextResponse.json({ error: 'account_id が必要です' }, { status: 400 })
  if (side !== 'debit' && side !== 'credit') return NextResponse.json({ error: 'side が不正です' }, { status: 400 })
  if (!Number.isInteger(amount) || (amount as number) < 0)
    return NextResponse.json({ error: 'amount は0以上の整数で入力してください' }, { status: 400 })

  const { error } = await supabaseAdmin.from('opening_balances')
    .upsert({ fiscal_year, account_id, side, amount }, { onConflict: 'fiscal_year,account_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
