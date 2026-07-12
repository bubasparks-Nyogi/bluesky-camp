import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { listReceiptFiles, isReceiptFile, getFolderMeta } from '@/lib/google/driveClient'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folderId = process.env.GOOGLE_DRIVE_RECEIPT_FOLDER_ID
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !folderId) {
    return NextResponse.json(
      { error: 'Google Drive 連携が未設定です。運用手順書のセットアップ手順をご覧ください。' },
      { status: 400 },
    )
  }

  try {
    const [allEntries, { data: imports }] = await Promise.all([
      listReceiptFiles(),
      supabaseAdmin.from('drive_receipt_imports').select('drive_file_id'),
    ])
    const folders = allEntries.filter(f => f.mimeType === FOLDER_MIME)
    const files = allEntries.filter(f => f.mimeType !== FOLDER_MIME)
    const receiptFiles = files.filter(isReceiptFile)
    const importedIds = new Set((imports ?? []).map(i => i.drive_file_id))

    const folderMeta = await getFolderMeta(folderId)

    return NextResponse.json({
      files: receiptFiles.map(f => ({
        id: f.id, name: f.name, mimeType: f.mimeType, createdTime: f.createdTime,
        imported: importedIds.has(f.id),
      })),
      diagnostics: {
        folderId,
        folderMeta,
        totalEntries: allEntries.length,
        subfolders: folders.length,
        subfolderNames: folders.slice(0, 5).map(f => f.name),
        totalFiles: files.length,
        receiptMatched: receiptFiles.length,
        nonReceiptSample: files
          .filter(f => !isReceiptFile(f))
          .slice(0, 5)
          .map(f => ({ name: f.name, mimeType: f.mimeType })),
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('drive-receipts list failed:', detail)
    return NextResponse.json(
      { error: `Drive 取得失敗: ${detail}` },
      { status: 502 },
    )
  }
}
