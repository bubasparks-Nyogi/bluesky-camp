import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_published', true)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post: data })
}
