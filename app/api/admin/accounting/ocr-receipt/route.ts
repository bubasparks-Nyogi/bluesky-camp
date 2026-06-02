import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseOcrResult } from '@/lib/accounting/ocrReceipt'
import { OCR_MODEL, OCR_MAX_IMAGE_BYTES } from '@/lib/ocrConfig'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OCRは未設定です。手入力をご利用ください' }, { status: 400 })

  let file: File | null = null
  try {
    const form = await req.formData()
    file = form.get('image') as File | null
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: '画像がありません' }, { status: 400 })
  if (file.size > OCR_MAX_IMAGE_BYTES) return NextResponse.json({ error: '画像サイズが大きすぎます（10MBまで）' }, { status: 413 })

  const arrayBuf = await file.arrayBuffer()
  const bytes = Buffer.from(arrayBuf)
  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const path = `${ym}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabaseAdmin.storage.from('receipts').upload(path, bytes, {
    contentType: file.type || 'image/jpeg', upsert: false,
  })
  if (upErr) return NextResponse.json({ error: `画像の保存に失敗しました: ${upErr.message}` }, { status: 500 })

  const { data: expenseAccounts } = await supabaseAdmin
    .from('accounts').select('code, name').eq('category', 'expense').eq('is_active', true).order('code')
  const candidates = (expenseAccounts ?? []).map(a => `${a.code}:${a.name}`).join(', ')
  const validCodes = (expenseAccounts ?? []).map(a => a.code as string)

  const rawType = (file.type || 'image/jpeg')
  const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(rawType)
    ? rawType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  const base64 = bytes.toString('base64')

  let draft = parseOcrResult('', validCodes)
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

  return NextResponse.json({ draft, receiptPath: path })
}
