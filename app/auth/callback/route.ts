import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const next = req.nextUrl.searchParams.get('next') ?? '/mypage'
  if (code) {
    const supabase = createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL(next, req.url))
}
