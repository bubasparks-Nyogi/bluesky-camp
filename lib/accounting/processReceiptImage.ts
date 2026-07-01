import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { parseOcrResult, type OcrDraft } from './ocrReceipt'
import { OCR_MODEL } from '@/lib/ocrConfig'

/**
 * レシート画像バイト列を受け取り、Supabase Storage 保存 + Claude OCR を行う共通処理。
 * ファイルアップロード経路（ocr-receipt）と Google Drive 取込経路の両方から使用。
 */
export async function processReceiptImage(
  bytes: Buffer,
  mimeType: string,
): Promise<{ draft: OcrDraft; receiptPath: string }> {
  const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const path = `${ym}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabaseAdmin.storage.from('receipts').upload(path, bytes, {
    contentType: mimeType || 'image/jpeg', upsert: false,
  })
  if (upErr) throw new Error(`画像の保存に失敗しました: ${upErr.message}`)

  const { data: expenseAccounts } = await supabaseAdmin
    .from('accounts').select('code, name').eq('category', 'expense').eq('is_active', true).order('code')
  const candidates = (expenseAccounts ?? []).map(a => `${a.code}:${a.name}`).join(', ')
  const validCodes = (expenseAccounts ?? []).map(a => a.code as string)

  const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
    ? mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  const base64 = bytes.toString('base64')

  let draft = parseOcrResult('', validCodes)
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: OCR_MODEL,
        max_tokens: 512,
        system: '日本のレシート画像から経費情報を抽出するアシスタント。必ずJSONのみを返す。説明文は不要。',
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text:
              `このレシートから次をJSONで返してください:\n` +
              `{"date":"YYYY-MM-DD","amount":整数の合計金額,"vendor":"店名","accountCode":"下の候補から最適なコード","confidence":"low|medium|high"}\n` +
              `費用科目の候補: ${candidates}\n` +
              `読めない項目は空文字、accountCodeは候補のコードのみ。JSON以外は出力しない。` },
          ],
        }],
      })
      const text = msg.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('\n')
      draft = parseOcrResult(text, validCodes)
    } catch (e) {
      console.error('OCR failed:', e)
    }
  }

  return { draft, receiptPath: path }
}
