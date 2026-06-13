import React from 'react'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchReservation, determineIsReissue } from '@/lib/receipt/lookup'
import { buildReceiptModel, buildCancellationFeeModel } from '@/lib/receipt/build'
import { calcCancellationFee } from '@/lib/cancellation'
import { renderPdfToBuffer } from '@/lib/receipt/pdf/renderToBuffer'
import ReceiptPdf from '@/lib/receipt/pdf/ReceiptPdf'
import CancellationFeePdf from '@/lib/receipt/pdf/CancellationFeePdf'
import { fetchSiteSettings } from '@/lib/site-settings'
import type { ReservationRow, PricingItem } from '@/types/reservation'
import type { SaleLineRow } from '@/lib/receipt/types'

export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get('id')
  const type  = req.nextUrl.searchParams.get('type')
  const email = req.nextUrl.searchParams.get('email')
  if (!id || !email || (type !== 'receipt' && type !== 'cancellation_fee'))
    return new Response('Bad Request', { status: 400 })

  const { data: r } = await supabaseAdmin
    .from('reservations').select('*').eq('id', id).maybeSingle()
  if (!r || !matchReservation(id, email, r))
    return new Response('Not Found', { status: 404 })
  const reservation = r as ReservationRow

  const { data: logs } = await supabaseAdmin
    .from('receipt_logs').select('type').eq('reservation_id', id)
  const isReissue = determineIsReissue(type, logs ?? [])
  const issuedAt = new Date().toISOString().slice(0, 10)

  let buf: Buffer
  let filename: string
  if (type === 'receipt') {
    const [{ data: pricingRows }, { data: saleLines }, settings] = await Promise.all([
      supabaseAdmin.from('pricing').select('*').eq('active', true),
      supabaseAdmin.from('sale_lines').select('*').eq('reservation_id', id),
      fetchSiteSettings().catch(() => null),
    ])
    const pricing: PricingItem[] = (pricingRows ?? []).map((p: { item_key: string; label: string; amount: number; active: boolean }) => ({
      itemKey: p.item_key, label: p.label, amount: p.amount, active: p.active,
    }))
    let isRepeater = false
    if (reservation.user_id) {
      const { count } = await supabaseAdmin
        .from('reservations').select('*', { count: 'exact', head: true })
        .eq('user_id', reservation.user_id).neq('id', reservation.id)
      isRepeater = (count ?? 0) >= 1
    }
    const model = buildReceiptModel(reservation, pricing, (saleLines ?? []) as SaleLineRow[], { isRepeater })
    buf = await renderPdfToBuffer(React.createElement(ReceiptPdf, {
      model, isReissue, issuedAt,
      siteAddress: settings?.address ?? undefined,
      sitePhone: settings?.phone ?? undefined,
    }))
    filename = `receipt-${model.reservationShortId}.pdf`
  } else {
    const [fee, settings] = [calcCancellationFee(reservation.checkin_date, reservation.total_amount), await fetchSiteSettings().catch(() => null)]
    const model = buildCancellationFeeModel(reservation, fee, issuedAt)
    buf = await renderPdfToBuffer(React.createElement(CancellationFeePdf, {
      model, isReissue, issuedAt,
      siteAddress: settings?.address ?? undefined,
      sitePhone: settings?.phone ?? undefined,
    }))
    filename = `cancellation-fee-${model.reservationShortId}.pdf`
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
