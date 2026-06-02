import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path が必要です' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage.from('receipts').createSignedUrl(path, 300)
  if (error || !data) return NextResponse.json({ error: error?.message ?? '署名URLの発行に失敗しました' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
