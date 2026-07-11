import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { downloadFile } from '@/lib/google/driveClient'

/**
 * Drive の画像をサービスアカウント経由でプロキシ配信する。
 * ブラウザから drive.google.com/thumbnail を直接見ようとすると、
 * 共有先がサービスアカウント（＝ログインユーザーではない）なので 403 になるため、
 * サーバでダウンロードして返す。
 */
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const fileId = req.nextUrl.searchParams.get('fileId')
  if (!fileId) return new NextResponse('fileId required', { status: 400 })

  try {
    const { bytes, mimeType } = await downloadFile(fileId)
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': mimeType || 'image/jpeg',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('drive-photo thumb failed:', detail)
    return new NextResponse(`Drive fetch failed: ${detail}`, { status: 502 })
  }
}
