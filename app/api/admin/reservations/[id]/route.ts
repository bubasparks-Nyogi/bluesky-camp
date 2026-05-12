// app/api/admin/reservations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // 許可するフィールドのみ更新（型安全のため明示）
  const update: Record<string, unknown> = {}
  if (body.checkin_date     !== undefined) update.checkin_date     = body.checkin_date
  if (body.checkout_date    !== undefined) update.checkout_date    = body.checkout_date
  if (body.stay_types       !== undefined) update.stay_types       = body.stay_types
  if (body.stay_type        !== undefined) update.stay_type        = body.stay_type
  if (body.ehu              !== undefined) update.ehu              = Boolean(body.ehu)
  if (body.sauna            !== undefined) update.sauna            = Boolean(body.sauna)
  if (body.pet              !== undefined) update.pet              = Boolean(body.pet)
  if (body.transfer_count   !== undefined) update.transfer_count   = Number(body.transfer_count)
  if (body.transfer_station !== undefined) update.transfer_station = body.transfer_station || null
  if (body.guest_name       !== undefined) update.guest_name       = body.guest_name
  if (body.guest_email      !== undefined) update.guest_email      = body.guest_email
  if (body.guest_phone      !== undefined) update.guest_phone      = body.guest_phone
  if (body.total_amount     !== undefined) update.total_amount     = Number(body.total_amount)
  if (body.status           !== undefined) update.status           = body.status

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reservation: data })
}
