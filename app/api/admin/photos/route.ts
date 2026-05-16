import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('photos').select('*').order('section').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const section  = formData.get('section') as string | null
  const caption  = formData.get('caption') as string | null

  if (!file || !section) {
    return NextResponse.json({ error: 'file と section が必要です' }, { status: 400 })
  }

  const ext      = file.name.split('.').pop()
  const filename = `${Date.now()}.${ext}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('photos').upload(filename, file, { contentType: file.type })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage.from('photos').getPublicUrl(filename)

  const { data, error } = await supabaseAdmin.from('photos')
    .insert({ url: publicUrl, caption: caption ?? null, section })
    .select().single()
  if (error) {
    await supabaseAdmin.storage.from('photos').remove([filename])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ photo: data }, { status: 201 })
}
