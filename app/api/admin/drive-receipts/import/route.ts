import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { downloadFile } from '@/lib/google/driveClient'
import { processReceiptImage } from '@/lib/accounting/processReceiptImage'
import { OCR_MAX_IMAGE_BYTES } from '@/lib/ocrConfig'
import { audit } from '@/lib/security/auditLog'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fileId?: string; fileName?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  if (!body.fileId) return NextResponse.json({ error: 'fileId が必要です' }, { status: 400 })

  try {
    const { bytes, mimeType } = await downloadFile(body.fileId)
    if (bytes.length > OCR_MAX_IMAGE_BYTES)
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます（10MBまで）' }, { status: 413 })

    const { draft, receiptPath, previewUrl, ocrError, ocrRaw } = await processReceiptImage(bytes, mimeType)

    // 取込記録（二重計上防止マーク）。UNIQUE 制約なので再取込時は上書き。
    await supabaseAdmin.from('drive_receipt_imports').upsert({
      drive_file_id: body.fileId,
      file_name: body.fileName ?? body.fileId,
      receipt_path: receiptPath,
      imported_at: new Date().toISOString(),
    }, { onConflict: 'drive_file_id' })

    await audit({
      actor: user.email ?? 'admin', action: 'drive_receipt.import',
      targetType: 'drive_file', targetId: body.fileId,
      detail: { fileName: body.fileName, receiptPath },
    })

    return NextResponse.json({ draft, receiptPath, previewUrl, ocrError, ocrRaw })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('drive-receipt import failed:', detail)
    return NextResponse.json({ error: `取込失敗: ${detail}` }, { status: 502 })
  }
}
