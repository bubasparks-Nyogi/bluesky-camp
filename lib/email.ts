// lib/email.ts
import { render } from '@react-email/components'
import { sendMail } from '@/lib/mailer'
import ReservationConfirm  from '@/emails/ReservationConfirm'
import ReservationNotify   from '@/emails/ReservationNotify'
import CancellationConfirm from '@/emails/CancellationConfirm'
import CancellationNotify  from '@/emails/CancellationNotify'
import ReceiptEmail from '@/emails/ReceiptEmail'
import CancellationFeeReceipt from '@/emails/CancellationFeeReceipt'
import type { ReceiptModel, CancellationFeeModel } from '@/lib/receipt/types'
import type { CancellationFeeResult } from '@/lib/cancellation'
import { getWeatherForecast } from '@/lib/weather'

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
 * @param r      予約データ
 * @param status 'pending'（確認中）または 'confirmed'（確定）。デフォルト 'pending'
 */
export async function sendReservationEmails(
  r: ReservationEmailData,
  status: 'pending' | 'confirmed' = 'pending',
): Promise<void> {
  const stayTypes = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId   = r.id.slice(0, 8).toUpperCase()
  const subject   = status === 'confirmed'
    ? `【@blueSky】ご予約確認 - ${shortId}`
    : `【@blueSky】ご予約受付 - ${shortId}`

  // 天気予報取得（失敗しても続行）
  const weather = await getWeatherForecast(r.checkin_date).catch(() => null)

  const weatherProps = weather ? {
    weatherIcon:    weather.icon,
    weatherLabel:   weather.label,
    weatherTempMax: weather.tempMax,
    weatherTempMin: weather.tempMin,
  } : {}

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
      status,
      ...weatherProps,
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
    sendMail({
      to:      r.guest_email,
      subject,
      html:    guestHtml,
    }),
    sendMail({
      to:      OWNER,
      subject: `【新規予約】${shortId} - ${r.guest_name} 様`,
      html:    ownerHtml,
    }),
  ])
}

/**
 * Stripe 決済完了後（Webhook）：お客様への「ご予約確定」メールを 1 通送信する。
 * オーナーへの再通知は不要（予約作成時に送信済み）。
 */
export async function sendReservationConfirmedEmail(
  r: ReservationEmailData,
): Promise<void> {
  const stayTypes = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId   = r.id.slice(0, 8).toUpperCase()

  const guestHtml = await render(ReservationConfirm({
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
    status:          'confirmed',
  }))

  await sendMail({
    to:      r.guest_email,
    subject: `【@blueSky】ご予約確定 - ${shortId}`,
    html:    guestHtml,
  })
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
    sendMail({
      to:      r.guest_email,
      subject: `【@blueSky】キャンセル受付 - ${shortId}`,
      html:    guestHtml,
    }),
    sendMail({
      to:      OWNER,
      subject: `【キャンセル】${shortId} - ${r.guest_name} 様`,
      html:    ownerHtml,
    }),
  ])
}

/**
 * 総合領収書を送信（B-3）。
 */
export async function sendReceiptEmail(model: ReceiptModel, to: string): Promise<void> {
  const html = await render(ReceiptEmail({ model }))
  await sendMail({
    to,
    subject: `【@blueSky】ご利用明細領収書 - ${model.reservationShortId}`,
    html,
  })
}

/**
 * キャンセル料明細書を送信（B-3）。
 */
export async function sendCancellationFeeEmail(model: CancellationFeeModel, to: string): Promise<void> {
  const html = await render(CancellationFeeReceipt({ model }))
  await sendMail({
    to,
    subject: `【@blueSky】キャンセル料明細書 - ${model.reservationShortId}`,
    html,
  })
}
