// lib/notifications.ts
import { Resend } from 'resend'
import type { ReservationRow } from '@/types/reservation'

const resend = new Resend(process.env.RESEND_API_KEY!)

const STAY_TYPE_LABELS: Record<string, string> = {
  tent:      'テント設営',
  trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB',
  campervan: 'キャンピングカー乗り入れ',
}

/** 予約確定後に呼ぶ。お客様へメール+LINE、オーナーへLINE送信 */
export async function sendReservationNotifications(
  r: ReservationRow,
): Promise<void> {
  const options = [
    r.sauna          && 'サウナ利用',
    r.pet            && 'ペット同伴',
    r.transfer_count > 0 && `送迎 ${r.transfer_count}名（${r.transfer_station}）`,
    r.ehu            && 'EHU外部電源',
  ].filter(Boolean).join('・') || 'なし'

  await Promise.allSettled([
    // 1. お客様へ確認メール
    sendGuestEmail(r, options),
    // 2. お客様へLINEメッセージ（LINE user IDがある場合のみ）
    r.line_user_id ? sendGuestLine(r, options) : Promise.resolve(),
    // 3. オーナーへLINE通知
    sendOwnerLine(r, options),
  ])
}

async function sendGuestEmail(r: ReservationRow, options: string) {
  await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL!,
    to:      r.guest_email,
    subject: `【@blueSky】ご予約確認 No.${r.id.slice(0, 8)}`,
    html: `
<h2>ご予約ありがとうございます</h2>
<p>${r.guest_name} 様</p>
<table>
  <tr><td>予約番号</td><td>${r.id.slice(0, 8)}</td></tr>
  <tr><td>チェックイン</td><td>${r.checkin_date}</td></tr>
  <tr><td>チェックアウト</td><td>${r.checkout_date}</td></tr>
  <tr><td>宿泊タイプ</td><td>${STAY_TYPE_LABELS[r.stay_type]}</td></tr>
  <tr><td>オプション</td><td>${options}</td></tr>
  <tr><td>合計金額</td><td>¥${r.total_amount.toLocaleString()}</td></tr>
</table>
<p>当日はお気をつけてお越しください。</p>
<p>@blueSky</p>
    `,
  })
}

async function sendGuestLine(r: ReservationRow, options: string) {
  const message = `【@blueSky】ご予約確認\n予約番号: ${r.id.slice(0, 8)}\nチェックイン: ${r.checkin_date}\n宿泊タイプ: ${STAY_TYPE_LABELS[r.stay_type]}\nオプション: ${options}\n合計: ¥${r.total_amount.toLocaleString()}`
  await lineReply(r.line_user_id!, message)
}

async function sendOwnerLine(r: ReservationRow, options: string) {
  const message = `【新規予約】\n${r.checkin_date} チェックイン\nお客様: ${r.guest_name}\n宿泊タイプ: ${STAY_TYPE_LABELS[r.stay_type]}\nオプション: ${options}\n合計: ¥${r.total_amount.toLocaleString()}\nメール: ${r.guest_email}`
  await lineReply(process.env.LINE_OWNER_USER_ID!, message)
}

async function lineReply(userId: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text }],
    }),
  })
}
