// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * APIルート・Webhook・Server Component で使用するクライアント（RLS バイパス）。
 *
 * 注意:
 * - すべての DB アクセスを **このクライアント経由・サーバーサイドのみ** で行う。
 * - クライアント側コードで直接 DB を叩かない（クライアント認証は createSupabaseBrowserClient 経由）。
 * - 認証フローは middleware の createServerClient + anon key で行う（別経路、データ参照無し）。
 *
 * N-5 セキュリティ強化（2026-06-13）: 以前あった `export const supabase`（anon key使用）を削除。
 * anon key 経由のデータ参照経路を完全に封じ、サービスロールキー経由のサーバー側のみとした。
 */
export const supabaseAdmin = createClient(url, serviceRole)
