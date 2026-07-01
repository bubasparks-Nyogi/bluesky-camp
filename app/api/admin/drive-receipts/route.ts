import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { listReceiptFiles } from '@/lib/google/driveClient'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_DRIVE_RECEIPT_FOLDER_ID) {
    return NextResponse.json(
      { error: 'Google Drive 連携が未設定です。運用手順書のセットアップ手順をご覧ください。' },
      { status: 400 },
    )
  }

  try {
    const [files, { data: imports }] = await Promise.all([
      listReceiptFiles(),
      supabaseAdmin.from('drive_receipt_imports').select('drive_file_id'),
    ])
    const importedIds = new Set((imports ?? []).map(i => i.drive_file_id))
    return NextResponse.json({
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        createdTime: f.createdTime,
        imported: importedIds.has(f.id),
      })),
    })
  } catch (e) {
    console.error('drive-receipts list failed:', e)
    return NextResponse.json(
      { error: 'Drive フォルダの取得に失敗しました。フォルダ共有と env 設定を確認してください。' },
      { status: 502 },
    )
  }
}
