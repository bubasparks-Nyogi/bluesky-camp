import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('rental_items')
    .select('id, name, price_per_day, available, image_url')
    .eq('available', true)
  const items = (data ?? []).map((r: {
    id: string; name: string; price_per_day: number; available: boolean; image_url: string | null
  }) => ({
    id: r.id, name: r.name, pricePerDay: r.price_per_day,
    available: r.available, imageUrl: r.image_url,
  }))
  return NextResponse.json({ items })
}
