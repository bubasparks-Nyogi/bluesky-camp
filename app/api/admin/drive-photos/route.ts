import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { listPhotoFiles } from '@/lib/google/driveClient'

type Section = 'hero' | 'facilities'
const isValidSection = (s: string | null): s is Section => s === 'hero' || s === 'facilities'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const section = req.nextUrl.searchParams.get('section')
  if (!isValidSection(section))
    return NextResponse.json({ error: 'section は hero または facilities のみ' }, { status: 400 })

  try {
    const files = await listPhotoFiles(section)
    const { data: imported } = await supabaseAdmin
      .from('drive_photo_imports').select('drive_file_id').eq('section', section)
    const importedSet = new Set((imported ?? []).map(r => r.drive_file_id as string))
    return NextResponse.json({
      files: files.map(f => ({ ...f, imported: importedSet.has(f.id) })),
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('drive-photos list failed:', detail)
    return NextResponse.json({ error: `Drive 取得失敗: ${detail}` }, { status: 502 })
  }
}
