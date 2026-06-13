import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reason?: string } = {}
  try { body = await req.json() } catch { /* body 任意 */ }

  const { data, error } = await supabaseAdmin
    .from('sale_drafts').update({
      status: 'rejected', rejected_reason: body.reason ?? null, updated_at: new Date().toISOString(),
    })
    .eq('id', params.id).eq('status', 'pending')
    .select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'pending な抽出案が見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
