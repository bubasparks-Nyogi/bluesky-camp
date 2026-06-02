import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path が必要です' }, { status: 400 })

  // 署名対象が実在する仕訳の証憑であることを確認（任意パス署名の防止）
  const { data: owner } = await supabaseAdmin
    .from('journal_entries')
    .select('id')
    .eq('receipt_url', path)
    .limit(1)
    .maybeSingle()
  if (!owner) return NextResponse.json({ error: 'レシートが見つかりません' }, { status: 404 })

  const { data, error } = await supabaseAdmin.storage.from('receipts').createSignedUrl(path, 300)
  if (error || !data) return NextResponse.json({ error: error?.message ?? '署名URLの発行に失敗しました' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
