import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export interface AdminContext {
  email: string
}

/**
 * 管理者APIで使用する共通認証ヘルパー。
 * - 認証必須
 * - ADMIN_EMAILS env（カンマ区切り）に含まれるメールのみ通す
 *
 * 使い方:
 *   const adminOrResponse = await requireAdmin()
 *   if (adminOrResponse instanceof NextResponse) return adminOrResponse
 *   // adminOrResponse.email を以降で使用
 */
export async function requireAdmin(): Promise<AdminContext | NextResponse> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  if (adminEmails.length === 0) {
    // 設定がまだ無い場合は、認証済みなら通す（B-7b 互換維持）
    // 本番では必ず ADMIN_EMAILS を設定すること
    console.warn('[requireAdmin] ADMIN_EMAILS not set; falling back to any authenticated user')
    return { email: user.email }
  }
  if (!adminEmails.includes(user.email.toLowerCase()))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return { email: user.email }
}
