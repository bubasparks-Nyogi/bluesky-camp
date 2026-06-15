import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const path = req.nextUrl.pathname

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() validates JWT against Supabase Auth server
  const { data: { user } } = await supabase.auth.getUser()

  // /admin/login は認証不要
  if (path === '/admin/login') {
    if (user) return NextResponse.redirect(new URL('/admin', req.url))
    return res
  }

  const isApi = path.startsWith('/api/admin')

  // 未認証
  if (!user) {
    return isApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/admin/login', req.url))
  }

  // S-1: ロールチェック（ADMIN_EMAILS 未設定なら認証済み全員を通す = 既存挙動）
  const adminEmails = parseAdminEmails()
  if (adminEmails.length > 0 && !adminEmails.includes((user.email ?? '').toLowerCase())) {
    return isApi
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.redirect(new URL('/admin/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
