// lib/notifications.ts
// LINE Push API ユーティリティ（将来の LINE 通知フェーズで使用）

/**
 * LINE Push API でメッセージを送信する。
 * @param userId  LINE ユーザーID または グループID
 * @param text    送信テキスト
 */
export async function lineReply(userId: string, text: string): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to:       userId,
      messages: [{ type: 'text', text }],
    }),
  })
}

/**
 * 予約確定時にオーナーへ LINE 通知を送信する。
 * OWNER_LINE_USER_ID が未設定の場合は静かにスキップする。
 */
export async function sendOwnerLineNotification(r: {
  guest_name:   string
  checkin_date: string
  stay_type:    string
  total_amount: number
}): Promise<void> {
  const userId = process.env.OWNER_LINE_USER_ID
  if (!userId) return

  const text = `【予約確定】${r.guest_name} 様\n📅 ${r.checkin_date}\n🏕 ${r.stay_type}\n💴 ¥${r.total_amount.toLocaleString()}`
  await lineReply(userId, text)
}
