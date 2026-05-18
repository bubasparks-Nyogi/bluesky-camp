import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { slugify } from '@/lib/slug'

const VALID_CATEGORIES = ['news', 'event', 'blog']

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const { title, body: postBody, excerpt, cover_image, category, slug, is_published } = body

  if (!title || typeof title !== 'string' || (title as string).trim().length === 0) {
    return NextResponse.json({ error: 'title が必要です' }, { status: 400 })
  }
  if (!postBody || typeof postBody !== 'string' || (postBody as string).trim().length === 0) {
    return NextResponse.json({ error: 'body が必要です' }, { status: 400 })
  }
  if (category !== undefined && !VALID_CATEGORIES.includes(category as string)) {
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  }

  const finalSlug = (typeof slug === 'string' && slug.trim().length > 0)
    ? slugify(slug as string)
    : slugify(title as string)

  const isPub = Boolean(is_published)
  const insertData: Record<string, unknown> = {
    slug: finalSlug,
    title: (title as string).trim(),
    body: (postBody as string),
    excerpt: typeof excerpt === 'string' ? excerpt : null,
    cover_image: typeof cover_image === 'string' && (cover_image as string).length > 0 ? cover_image : null,
    category: (category as string) ?? 'news',
    is_published: isPub,
    published_at: isPub ? new Date().toISOString() : null,
  }

  const { data, error } = await supabaseAdmin.from('posts').insert(insertData).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data }, { status: 201 })
}
