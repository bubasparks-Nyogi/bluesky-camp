import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { slugify } from '@/lib/slug'

const VALID_CATEGORIES = ['news', 'event', 'blog']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category as string)) {
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title       !== undefined) update.title       = body.title
  if (body.body        !== undefined) update.body        = body.body
  if (body.excerpt     !== undefined) update.excerpt     = body.excerpt
  if (body.cover_image !== undefined) update.cover_image = body.cover_image
  if (body.category    !== undefined) update.category    = body.category
  if (body.slug        !== undefined && typeof body.slug === 'string' && (body.slug as string).trim().length > 0) {
    update.slug = slugify(body.slug as string)
  }
  if (body.is_published !== undefined) {
    update.is_published = Boolean(body.is_published)
    if (Boolean(body.is_published)) {
      const { data: existing } = await supabaseAdmin.from('posts').select('published_at').eq('id', params.id).maybeSingle()
      if (existing && !existing.published_at) {
        update.published_at = new Date().toISOString()
      }
    }
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('posts').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin.from('posts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
