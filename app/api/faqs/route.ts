import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPublicGetLimit } from '@/lib/security/publicGetLimit'

export async function GET(req: NextRequest) {
  const limited = checkPublicGetLimit(req, 'faqs')
  if (limited) return limited

  const { data, error } = await supabaseAdmin
    .from('faqs')
    .select('*')
    .eq('is_published', true)
    .order('category')
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faqs: data ?? [] })
}
