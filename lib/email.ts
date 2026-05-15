// lib/email.ts
import { Resend } from 'resend'
import { render } from '@react-email/components'
import ReservationConfirm  from '@/emails/ReservationConfirm'
import ReservationNotify   from '@/emails/ReservationNotify'
import CancellationConfirm from '@/emails/CancellationConfirm'
import CancellationNotify  from '@/emails/CancellationNotify'
import type { CancellationFeeResult } from '@/lib/cancellation'

const resend    = new Resend(process.env.RESEND_API_KEY!)
const FROM      = process.env.RESEND_FROM_EMAIL!
const OWNER     = process.env.OWNER_EMAIL!
const SITE      = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const ADMIN_URL = `${SITE}/admin/reservations`

interface ReservationEmailData {
  id:               string
  guest_name:       string
  guest_email:      string
  guest_phone:      string
  checkin_date:     string
  checkout_date:    string
  stay_types:       string[]
  stay_type:        string
  sauna:            boolean
  pet:              boolean
  ehu:              boolean
  transfer_count:   number
  transfer_station: string | null
  total_amount:     number
}

/**
 * 予約作成後：お客様への確認メール + オーナーへの通知メールを送信する。
 * 失敗しても例外を投げない（呼び出し元でベストエフォート処理すること）。
 */
export async function sendReservationEmails(r: ReservationEmailData): Promise<void> {
  const stayTypes = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId   = r.id.slice(0, 8).toUpperCase()

  const [guestHtml, ownerHtml] = await Promise.all([
    render(ReservationConfirm({
      reservationId:   r.id,
      guestName:       r.guest_name,
      checkinDate:     r.checkin_date,
      checkoutDate:    r.checkout_date,
      stayTypes,
      sauna:           r.sauna,
      pet:             r.pet,
      ehu:             r.ehu,
      transferCount:   r.transfer_count,
      transferStation: r.transfer_station,
      totalAmount:     r.total_amount,
      siteUrl:         SITE,
    })),
    render(ReservationNotify({
      reservationId:   r.id,
      guestName:       r.guest_name,
      guestEmail:      r.guest_email,
      guestPhone:      r.guest_phone,
      checkinDate:     r.checkin_date,
      checkoutDate:    r.checkout_date,
      stayTypes,
      sauna:           r.sauna,
      pet:             r.pet,
      ehu:             r.ehu,
      transferCount:   r.transfer_count,
      transferStation: r.transfer_station,
      totalAmount:     r.total_amount,
      adminUrl:        ADMIN_URL,
    })),
  ])

  await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      r.guest_email,
      subject: `【@blueSky】ご予約確認 - ${shortId}`,
      html:    guestHtml,
    }),
    resend.emails.send({
      from:    FROM,
      to:      OWNER,
      subject: `【新規予約】${shortId} - ${r.guest_name} 様`,
      html:    ownerHtml,
    }),
  ])
}

/**
 * キャンセル後：お客様へのキャンセル確認メール + オーナーへの通知メールを送信する。
 * 失敗しても例外を投げない（呼び出し元でベストエフォート処理すること）。
 */
export async function sendCancellationEmails(
  r: ReservationEmailData,
  fee: CancellationFeeResult,
): Promise<void> {
  const stayTypes   = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId     = r.id.slice(0, 8).toUpperCase()
  const cancelledAt = new Date().toISOString()

  const [guestHtml, ownerHtml] = await Promise.all([
    render(CancellationConfirm({
      reservationId: r.id,
      guestName:     r.guest_name,
      checkinDate:   r.checkin_date,
      checkoutDate:  r.checkout_date,
      stayTypes,
      feeRate:       fee.rate,
      feeAmount:     fee.fee,
      feeLabel:      fee.label,
      siteUrl:       SITE,
    })),
    render(CancellationNotify({
      reservationId: r.id,
      guestName:     r.guest_name,
      guestEmail:    r.guest_email,
      guestPhone:    r.guest_phone,
      checkinDate:   r.checkin_date,
      checkoutDate:  r.checkout_date,
      stayTypes,
      totalAmount:   r.total_amount,
      feeRate:       fee.rate,
      feeAmount:     fee.fee,
      feeLabel:      fee.label,
      cancelledAt,
      adminUrl:      ADMIN_URL,
    })),
  ])

  await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      r.guest_email,
      subject: `【@blueSky】キャンセル受付 - ${shortId}`,
      html:    guestHtml,
    }),
    resend.emails.send({
      from:    FROM,
      to:      OWNER,
      subject: `【キャンセル】${shortId} - ${r.guest_name} 様`,
      html:    ownerHtml,
    }),
  ])
}
