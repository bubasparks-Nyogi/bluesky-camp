// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** ブラウザ・Server Componentで使用（読み取り専用操作） */
export const supabase = createClient(url, anon)

/** APIルート・Webhookで使用（書き込み操作） */
export const supabaseAdmin = createClient(url, serviceRole)
