// lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server Component / Route Handler 用の Supabase クライアント。
 * セッション Cookie を読み書きするため @supabase/ssr を使用。
 * Server Component 内で setAll が呼ばれても例外は無視する（読み取り専用フロー）。
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component から呼ばれた場合は無視する
          }
        },
      },
    }
  )
}
