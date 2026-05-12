import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates JWT against Supabase Auth server
  const { data: { user } } = await supabase.auth.getUser()

  // /admin/login は認証不要
  if (req.nextUrl.pathname === '/admin/login') {
    // ログイン済みなら /admin にリダイレクト
    if (user) return NextResponse.redirect(new URL('/admin', req.url))
    return res
  }

  // それ以外の /admin/* はログイン必須
  if (!user) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}
