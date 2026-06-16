/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'frdiafkdjeaslhwlvfxa.supabase.co' },
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/admin/manual':      ['./docs/operations-manual.md'],
      '/help':              ['./docs/customer-guide.md'],
      '/admin/usage-guide': ['./docs/admin-usage-guide.md'],
    },
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js は inline script を一部使用、Stripe/Komoju/GA 等の外部 script を許可
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://komoju.com https://*.komoju.com https://liff.line.me https://static.line-scdn.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://frdiafkdjeaslhwlvfxa.supabase.co https://www.google.com https://maps.googleapis.com https://www.google-analytics.com https://*.googleusercontent.com https://obs.line-scdn.net",
      "connect-src 'self' https://frdiafkdjeaslhwlvfxa.supabase.co wss://frdiafkdjeaslhwlvfxa.supabase.co https://komoju.com https://*.komoju.com https://api.line.me https://www.google-analytics.com",
      "frame-src 'self' https://komoju.com https://*.komoju.com https://www.google.com https://liff.line.me",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://komoju.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy',   value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
