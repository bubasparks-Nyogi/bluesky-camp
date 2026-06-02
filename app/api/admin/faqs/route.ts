import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('faqs').select('*').order('category').order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faqs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { question, answer, category, sort_order, is_published } = body
  if (!question || !answer) {
    return NextResponse.json({ error: 'question と answer が必要です' }, { status: 400 })
  }
  const VALID_CATEGORIES = ['general', 'pricing', 'access', 'facility']
  if (category !== undefined && !VALID_CATEGORIES.includes(category as string)) {
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  }
  if (sort_order !== undefined && !Number.isInteger(sort_order)) {
    return NextResponse.json({ error: 'sort_order は整数で指定してください' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('faqs')
    .insert({
      question,
      answer,
      category:     category     ?? 'general',
      sort_order:   sort_order   ?? 0,
      is_published: is_published ?? true,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faq: data }, { status: 201 })
}
