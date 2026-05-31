import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const VALID_CATEGORIES = ['asset', 'liability', 'equity', 'revenue', 'expense']
const VALID_SIDES = ['debit', 'credit']

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('accounts').select('*').order('sort_order').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { code, name, category, normal_balance, sort_order } = body
  if (!code || !name) return NextResponse.json({ error: 'code と name が必要です' }, { status: 400 })
  if (!VALID_CATEGORIES.includes(category as string))
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  if (!VALID_SIDES.includes(normal_balance as string))
    return NextResponse.json({ error: 'normal_balance が不正です' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('accounts').insert({
    code, name, category, normal_balance,
    sort_order: Number.isInteger(sort_order) ? sort_order : 999,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data }, { status: 201 })
}
