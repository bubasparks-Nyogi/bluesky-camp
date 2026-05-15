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
