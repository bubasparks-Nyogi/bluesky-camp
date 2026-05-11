import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabase.from('pricing').select('*').eq('active', true)
  const pricing = (data ?? []).map((p: {
    item_key: string; label: string; amount: number; active: boolean
  }) => ({
    itemKey: p.item_key, label: p.label, amount: p.amount, active: p.active,
  }))
  return NextResponse.json({ pricing })
}
