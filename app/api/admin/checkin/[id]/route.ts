import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: r } = await supabaseAdmin
    .from('reservations').select('id, status, checked_in_at').eq('id', params.id).maybeSingle()
  if (!r) return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  if (r.status === 'cancelled')
    return NextResponse.json({ error: 'キャンセル済みの予約はチェックインできません' }, { status: 409 })

  const { error } = await supabaseAdmin
    .from('reservations').update({ checked_in_at: new Date().toISOString() }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
