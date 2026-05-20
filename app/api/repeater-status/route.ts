import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ isRepeater: false, stayCount: 0 })

  const { count } = await supabaseAdmin
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const stayCount = count ?? 0
  return NextResponse.json({ isRepeater: stayCount >= 1, stayCount })
}
