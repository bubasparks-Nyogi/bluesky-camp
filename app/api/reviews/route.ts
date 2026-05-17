import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('id, guest_name, rating, comment, visit_date, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviews: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const { guest_name, rating, comment, visit_date } = body

  if (!guest_name || typeof guest_name !== 'string' || (guest_name as string).trim().length === 0) {
    return NextResponse.json({ error: 'guest_name が必要です' }, { status: 400 })
  }
  if (!comment || typeof comment !== 'string' || (comment as string).trim().length === 0) {
    return NextResponse.json({ error: 'comment が必要です' }, { status: 400 })
  }
  const ratingNum = Number(rating)
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: 'rating は 1〜5 の整数で指定してください' }, { status: 400 })
  }

  const insertData: Record<string, unknown> = {
    guest_name: (guest_name as string).trim(),
    rating: ratingNum,
    comment: (comment as string).trim(),
    is_published: false,
  }
  if (visit_date && typeof visit_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(visit_date)) {
    insertData.visit_date = visit_date
  }

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .insert(insertData)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data, message: 'レビューを受け付けました。確認後に公開されます。' }, { status: 201 })
}
