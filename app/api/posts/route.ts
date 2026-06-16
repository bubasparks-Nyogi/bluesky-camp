import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPublicGetLimit } from '@/lib/security/publicGetLimit'

const VALID_CATEGORIES = ['news', 'event', 'blog']

export async function GET(req: NextRequest) {
  const limited = checkPublicGetLimit(req, 'posts')
  if (limited) return limited

  const category = req.nextUrl.searchParams.get('category')

  let query = supabaseAdmin
    .from('posts')
    .select('id, slug, title, excerpt, cover_image, category, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })

  if (category && VALID_CATEGORIES.includes(category)) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}
