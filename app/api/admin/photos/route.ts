import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('photos').select('*').order('section').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const fileEntry = formData.get('file')
  const file      = fileEntry instanceof File ? fileEntry : null
  const section   = formData.get('section') as string | null
  const caption   = formData.get('caption') as string | null

  if (!file || !section) {
    return NextResponse.json({ error: 'file と section が必要です' }, { status: 400 })
  }

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '許可されていないファイル形式です。JPEG、PNG、WebP、GIF のみ使用できます' }, { status: 400 })
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'ファイルサイズは 10MB 以下にしてください' }, { status: 400 })
  }

  const ALLOWED_SECTIONS = ['hero', 'facilities']
  if (!ALLOWED_SECTIONS.includes(section)) {
    return NextResponse.json({ error: 'section は hero または facilities のみ使用できます' }, { status: 400 })
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
