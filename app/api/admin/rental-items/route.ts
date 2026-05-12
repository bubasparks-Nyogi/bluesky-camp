import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, price_per_day } = await req.json()
  if (!name || !price_per_day) return NextResponse.json({ error: '名前と料金が必要です' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('rental_items')
    .insert({ name, price_per_day: Number(price_per_day), available: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}
