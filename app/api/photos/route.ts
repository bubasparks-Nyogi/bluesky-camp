import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get('section')
  let query = supabaseAdmin.from('photos').select('*').order('sort_order')
  if (section) query = query.eq('section', section)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ photos: data ?? [] })
}
