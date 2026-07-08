import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { listPhotoFiles, isImageFile, getFolderMeta } from '@/lib/google/driveClient'

type Section = 'hero' | 'facilities'
const isValidSection = (s: string | null): s is Section => s === 'hero' || s === 'facilities'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const section = req.nextUrl.searchParams.get('section')
  if (!isValidSection(section))
    return NextResponse.json({ error: 'section は hero または facilities のみ' }, { status: 400 })

  const envKey = section === 'hero' ? 'GOOGLE_DRIVE_HERO_FOLDER_ID' : 'GOOGLE_DRIVE_FACILITIES_FOLDER_ID'
  const folderId = process.env[envKey]

  try {
    const allEntries = await listPhotoFiles(section)
    const folders = allEntries.filter(f => f.mimeType === FOLDER_MIME)
    const files = allEntries.filter(f => f.mimeType !== FOLDER_MIME)
    const imageFiles = files.filter(isImageFile)

    // フォルダ自体のアクセス可否
    const folderMeta = folderId ? await getFolderMeta(folderId) : { error: 'env 未設定' }

    const { data: imported } = await supabaseAdmin
      .from('drive_photo_imports').select('drive_file_id').eq('section', section)
    const importedSet = new Set((imported ?? []).map(r => r.drive_file_id as string))

    return NextResponse.json({
      files: imageFiles.map(f => ({ ...f, imported: importedSet.has(f.id) })),
      diagnostics: {
        folderId,
        folderMeta,
        totalEntries: allEntries.length,
        subfolders: folders.length,
        subfolderNames: folders.slice(0, 5).map(f => f.name),
        totalFiles: files.length,
        imageMatched: imageFiles.length,
        nonImageSample: files
          .filter(f => !isImageFile(f))
          .slice(0, 5)
          .map(f => ({ name: f.name, mimeType: f.mimeType })),
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('drive-photos list failed:', detail)
    return NextResponse.json({ error: `Drive 取得失敗: ${detail}` }, { status: 502 })
  }
}
