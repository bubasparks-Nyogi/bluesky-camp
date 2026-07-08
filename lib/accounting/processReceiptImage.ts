import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { parseOcrResult, type OcrDraft } from './ocrReceipt'
import { OCR_MODEL } from '@/lib/ocrConfig'

/**
 * レシート画像バイト列を受け取り、Supabase Storage 保存 + Claude OCR を行う共通処理。
 * ファイルアップロード経路（ocr-receipt）と Google Drive 取込経路の両方から使用。
 */
export interface ProcessReceiptResult {
  draft: OcrDraft
  receiptPath: string
  previewUrl: string | null
  ocrError: string | null   // OCR が失敗した場合のエラー詳細（診断用）
  ocrRaw: string | null     // Claude の生レスポンス（フィールド抽出できなかった場合）
}

export async function processReceiptImage(
  bytes: Buffer,
  mimeType: string,
): Promise<ProcessReceiptResult> {
  const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const path = `${ym}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabaseAdmin.storage.from('receipts').upload(path, bytes, {
    contentType: mimeType || 'image/jpeg', upsert: false,
  })
  if (upErr) throw new Error(`画像の保存に失敗しました: ${upErr.message}`)

  // プレビュー用の署名付きURL（1時間有効）
  let previewUrl: string | null = null
  try {
    const { data: signed } = await supabaseAdmin.storage.from('receipts')
      .createSignedUrl(path, 3600)
    previewUrl = signed?.signedUrl ?? null
  } catch (e) {
    console.warn('[previewUrl] failed:', e instanceof Error ? e.message : e)
  }

  const { data: expenseAccounts } = await supabaseAdmin
    .from('accounts').select('code, name').eq('category', 'expense').eq('is_active', true).order('code')
  const candidates = (expenseAccounts ?? []).map(a => `${a.code}:${a.name}`).join(', ')
  const validCodes = (expenseAccounts ?? []).map(a => a.code as string)

  const isPdf = mimeType === 'application/pdf'
  const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
    ? mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  const base64 = bytes.toString('base64')

  // PDF は Claude の document ブロックでネイティブ処理（追加サービス不要）
  const fileBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64 } }

  let draft = parseOcrResult('', validCodes)
  let ocrError: string | null = null
  let ocrRaw: string | null = null

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    ocrError = 'ANTHROPIC_API_KEY が未設定です'
  } else {
    try {
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: OCR_MODEL,
        max_tokens: 512,
        system: '日本のレシート画像から経費情報を抽出するアシスタント。必ずJSONのみを返す。説明文は不要。',
        messages: [{
          role: 'user',
          content: [
            fileBlock,
            { type: 'text', text:
              `このレシートから次をJSONで返してください:\n` +
              `{"date":"YYYY-MM-DD","amount":整数の合計金額,"vendor":"店名","accountCode":"下の候補から最適なコード","confidence":"low|medium|high"}\n` +
              `費用科目の候補: ${candidates}\n\n` +
              `【当キャンプ場の費用科目分類ルール（重要）】\n` +
              `- 食料品・飲料・食材・肉・野菜・米・氷・酒類 → 「仕入高」(501)（お客様に販売・提供する原価）\n` +
              `- 薪・木炭・BBQ用炭・着火剤 → 「仕入高」(501)（販売品）\n` +
              `- キャンプ用消耗品（紙皿・割り箸・使い捨てコップ等）で販売用 → 「仕入高」(501)\n` +
              `- 事務用品（文房具・コピー用紙・インク）・清掃用品（洗剤・雑巾・トイレ紙）・電池・小工具 → 「消耗品費」(519)\n` +
              `- ガソリン・電車・タクシー・高速料金・駐車場 → 「旅費交通費」(513)\n` +
              `- 電気・ガス・水道 → 「水道光熱費」(512)\n` +
              `- 電話・インターネット・切手・郵送料 → 「通信費」(514)\n` +
              `- 修繕・メンテナンス費用 → 「修繕費」(518)\n` +
              `- 取引先との飲食・手土産 → 「接待交際費」(516)\n` +
              `- 広告・宣伝物・チラシ・SNS広告 → 「広告宣伝費」(515)\n\n` +
              `※ 「食料品」を「消耗品費」に分類するのは誤り。食品は原則「仕入高」。\n` +
              `※ 迷ったら店名・品目から用途を推定し、上記ルールを優先すること。\n\n` +
              `読めない項目は空文字、accountCodeは候補のコードのみ。JSON以外は出力しない。` },
          ],
        }],
      })
      const text = msg.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('\n')
      draft = parseOcrResult(text, validCodes)
      if (!draft.date && !draft.amount) {
        ocrRaw = text.slice(0, 500)
        console.warn('[OCR] no fields extracted. raw response:', ocrRaw)
      }
    } catch (e) {
      ocrError = e instanceof Error ? e.message : String(e)
      console.error('[OCR] failed:', ocrError)
    }
  }

  return { draft, receiptPath: path, previewUrl, ocrError, ocrRaw }
}
