import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { reservationsCsv, type ReservationCsvRow } from '@/lib/reservations/reservationsCsv'

const STATUS_LABELS: Record<string, string> = {
  pending: '確認中', confirmed: '確定', cancelled: 'キャンセル済',
}
const STAY_LABELS: Record<string, string> = {
  tent: 'テント', trailer_a: 'トレーラーA', trailer_b: 'トレーラーB', campervan: 'キャンピングカー',
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const sp = req.nextUrl.searchParams

  let query = supabaseAdmin.from('reservations').select('*').order('checkin_date', { ascending: false })
  const q = sp.get('q')
  if (q) {
    const pattern = `%${q}%`
    query = query.or(`guest_name.ilike.${pattern},guest_email.ilike.${pattern},guest_phone.ilike.${pattern}`)
  }
  const status = sp.get('status')
  if (status && status !== 'all') query = query.eq('status', status)
  const stay = sp.get('stay')
  if (stay && stay !== 'all') query = query.eq('stay_type', stay)
  const from = sp.get('from')
  if (from) query = query.gte('checkin_date', from)
  const to = sp.get('to')
  if (to) query = query.lte('checkin_date', to)

  const { data, error } = await query
  if (error) return new NextResponse(`Error: ${error.message}`, { status: 500 })

  const rows: ReservationCsvRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const types = Array.isArray(r.stay_types) && (r.stay_types as unknown[]).length
      ? (r.stay_types as string[])
      : [(r.stay_type as string)]
    return {
      shortId: (r.id as string).slice(0, 8).toUpperCase(),
      status:  STATUS_LABELS[(r.status as string)] ?? (r.status as string),
      checkinDate:  r.checkin_date  as string,
      checkoutDate: r.checkout_date as string,
      stayTypes: types.map(t => STAY_LABELS[t] ?? t).join('・'),
      guestName:  r.guest_name  as string,
      guestEmail: r.guest_email as string,
      guestPhone: r.guest_phone as string,
      totalAmount: r.total_amount as number,
      createdAt: r.created_at as string,
    }
  })

  const csv = reservationsCsv(rows)
  const today = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reservations_${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
