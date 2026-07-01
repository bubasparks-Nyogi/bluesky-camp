import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { processReceiptImage } from '@/lib/accounting/processReceiptImage'
import { OCR_MAX_IMAGE_BYTES } from '@/lib/ocrConfig'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'OCRは未設定です。手入力をご利用ください' }, { status: 400 })

  let file: File | null = null
  try {
    const form = await req.formData()
    file = form.get('image') as File | null
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: '画像がありません' }, { status: 400 })
  if (file.size > OCR_MAX_IMAGE_BYTES) return NextResponse.json({ error: '画像サイズが大きすぎます（10MBまで）' }, { status: 413 })

  const bytes = Buffer.from(await file.arrayBuffer())
  try {
    const { draft, receiptPath } = await processReceiptImage(bytes, file.type || 'image/jpeg')
    return NextResponse.json({ draft, receiptPath })
  } catch (e) {
    console.error('ocr-receipt failed:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : '処理に失敗しました' }, { status: 500 })
  }
}
