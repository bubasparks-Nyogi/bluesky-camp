import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { postCancellationEntry } from '@/lib/accounting/cancelHook'
import { postCancellationFeeReceipt } from '@/lib/receipt/cancelFeeHook'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = await req.json()
  if (!['confirmed', 'cancelled', 'pending'].includes(status))
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })

  const { error } = await supabaseAdmin.from('reservations').update({ status }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'cancelled') {
    try {
      await postCancellationEntry(params.id)
    } catch (e) {
      console.error('postCancellationEntry failed:', e)
    }
    try {
      await postCancellationFeeReceipt(params.id)
    } catch (e) {
      console.error('postCancellationFeeReceipt failed:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
