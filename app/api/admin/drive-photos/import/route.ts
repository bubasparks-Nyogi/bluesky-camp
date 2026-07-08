import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { downloadFile } from '@/lib/google/driveClient'
import { audit } from '@/lib/security/auditLog'

type Section = 'hero' | 'facilities'
const isValidSection = (s: unknown): s is Section => s === 'hero' || s === 'facilities'
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fileId?: string; fileName?: string; section?: string; caption?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  if (!body.fileId)                  return NextResponse.json({ error: 'fileId が必要です' }, { status: 400 })
  if (!isValidSection(body.section)) return NextResponse.json({ error: 'section は hero または facilities のみ' }, { status: 400 })
  const section = body.section

  try {
    const { bytes, mimeType } = await downloadFile(body.fileId)
    if (bytes.length > MAX_BYTES)
      return NextResponse.json({ error: 'ファイルサイズが大きすぎます（10MBまで）' }, { status: 413 })
    // Drive for Desktop 経由の画像は mime が octet-stream になることがあるため、
    // ファイル名の拡張子でも許可判定する。
    const isImageMime = /^image\//.test(mimeType)
    const nameExtMatch = (body.fileName ?? '').match(/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i)
    if (!isImageMime && !nameExtMatch)
      return NextResponse.json({ error: '画像ファイルのみ取り込めます' }, { status: 400 })

    const extFromName = nameExtMatch?.[1]?.toLowerCase().replace('jpeg', 'jpg')
    const ext = (isImageMime
      ? (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      : (extFromName || 'jpg'))
    const storeMime = isImageMime ? mimeType
      : extFromName === 'png' ? 'image/png'
      : extFromName === 'webp' ? 'image/webp'
      : extFromName === 'gif' ? 'image/gif'
      : 'image/jpeg'
    const filename = `drive-${section}-${Date.now()}.${ext}`

    const { error: upErr } = await supabaseAdmin.storage.from('photos').upload(filename, bytes, {
      contentType: storeMime, upsert: false,
    })
    if (upErr) return NextResponse.json({ error: `画像の保存に失敗しました: ${upErr.message}` }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage.from('photos').getPublicUrl(filename)

    // sort_order は既存最大 + 1
    const { data: existing } = await supabaseAdmin
      .from('photos').select('sort_order').eq('section', section)
      .order('sort_order', { ascending: false }).limit(1)
    const nextOrder = ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1

    const { data: photo, error: photoErr } = await supabaseAdmin.from('photos').insert({
      url: publicUrl,
      caption: body.caption?.trim() || body.fileName?.replace(/\.[^.]+$/, '') || null,
      section, sort_order: nextOrder,
    }).select().single()
    if (photoErr) {
      await supabaseAdmin.storage.from('photos').remove([filename])
      return NextResponse.json({ error: photoErr.message }, { status: 500 })
    }

    await supabaseAdmin.from('drive_photo_imports').upsert({
      drive_file_id: body.fileId,
      section,
      file_name: body.fileName ?? body.fileId,
      photo_id: photo.id,
      imported_at: new Date().toISOString(),
    }, { onConflict: 'drive_file_id' })

    await audit({
      actor: user.email ?? 'admin', action: 'drive_photo.import',
      targetType: 'drive_file', targetId: body.fileId,
      detail: { section, fileName: body.fileName, photoId: photo.id },
    })

    return NextResponse.json({ photo })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('drive-photo import failed:', detail)
    return NextResponse.json({ error: `取込失敗: ${detail}` }, { status: 502 })
  }
}
