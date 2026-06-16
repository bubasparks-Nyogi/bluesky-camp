import { NextRequest, NextResponse } from 'next/server'
import { memoryRateLimit } from './rateLimit'

/**
 * 公開GETエンドポイント向けの軽いレート制限。
 * 同一IPで 1分間に最大 60回まで（人間の操作は十分カバー、スクレイピング系を緩く弾く）。
 */
export function checkPublicGetLimit(req: NextRequest, scope: string): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (memoryRateLimit(`pubget:${scope}:${ip}`, 60 * 1000, 60)) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。少し時間をおいて再度お試しください。' },
      { status: 429 },
    )
  }
  return null
}
