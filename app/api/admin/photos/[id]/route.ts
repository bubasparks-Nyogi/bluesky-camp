import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sort_order } = await req.json()

  if (sort_order === undefined || sort_order === null || !Number.isFinite(sort_order) || !Number.isInteger(sort_order)) {
    return NextResponse.json({ error: 'sort_order は整数で指定してください' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('photos')
    .update({ sort_order }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: photo } = await supabaseAdmin.from('photos')
    .select('url').eq('id', params.id).single()

  if (photo) {
    const filename = photo.url.split('/').pop()
    if (filename) {
      await supabaseAdmin.storage.from('photos').remove([filename])
    }
  }

  const { error } = await supabaseAdmin.from('photos').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
