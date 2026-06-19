import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('site_settings').select('*').eq('id', 1).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { checkinTime?: string; checkoutTime?: string; address?: string; phone?: string; guideNote?: string; accessNote?: string; ehuRate?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.checkinTime  !== undefined) update.checkin_time  = body.checkinTime
  if (body.checkoutTime !== undefined) update.checkout_time = body.checkoutTime
  if (body.address      !== undefined) update.address       = body.address
  if (body.phone        !== undefined) update.phone         = body.phone
  if (body.guideNote    !== undefined) update.guide_note    = body.guideNote
  if (body.accessNote   !== undefined) update.access_note   = body.accessNote
  if (body.ehuRate      !== undefined) {
    if (typeof body.ehuRate !== 'number' || body.ehuRate < 0 || body.ehuRate > 10000)
      return NextResponse.json({ error: 'EHU単価は 0〜10000 の整数で指定してください' }, { status: 400 })
    update.ehu_rate = Math.round(body.ehuRate)
    // items.EHU使用料 の sale_price も同期
    await supabaseAdmin.from('items').update({ sale_price: Math.round(body.ehuRate) }).eq('name', 'EHU使用料')
  }

  const { data, error } = await supabaseAdmin
    .from('site_settings').update(update).eq('id', 1).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
