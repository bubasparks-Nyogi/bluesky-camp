import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const metadata = { title: 'マイページ' }

export default async function MyPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: reservations } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .eq('user_id', user.id)
    .order('checkin_date', { ascending: false })

  const stays = reservations ?? []
  const stayCount = stays.length
  const isRepeater = stayCount >= 1
  const tierLabel = isRepeater ? 'リピーター（10% OFF適用）' : 'ノーマル会員'

  return (
    <main className="min-h-screen bg-warm-50 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl text-warm-700 mb-2">マイページ</h1>
        <p className="text-warm-400 text-sm mb-8">{user.email}</p>

        <div className="bg-white border border-warm-100 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-warm-400 text-xs mb-1">会員ステータス</p>
              <p className="font-bold text-warm-700 text-lg">{tierLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-warm-400 text-xs mb-1">累計予約</p>
              <p className="font-bold text-warm-700 text-2xl">{stayCount}<span className="text-sm text-warm-400 ml-1">回</span></p>
            </div>
          </div>
        </div>

        <h2 className="font-serif text-xl text-warm-700 mb-4">予約履歴</h2>
        {stays.length === 0 ? (
          <p className="text-center text-warm-400 py-12 bg-white border border-warm-100 rounded-2xl">
            予約履歴はまだありません
          </p>
        ) : (
          <div className="space-y-3">
            {stays.map((r: any) => (
              <div key={r.id} className="bg-white border border-warm-100 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <span className="font-medium text-warm-700">
                    {r.checkin_date} 〜 {r.checkout_date}
                  </span>
                  <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">
                    {r.status ?? '予約中'}
                  </span>
                </div>
                <p className="text-warm-500 text-sm">
                  合計 ¥{(r.total_amount ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link href="/reserve" className="inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-6 py-3 rounded-lg transition-colors">
            新しい予約をする
          </Link>
        </div>
      </div>
    </main>
  )
}
