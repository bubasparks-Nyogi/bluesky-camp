import { supabaseAdmin } from '@/lib/supabase'
import BlockedDatesForm from '@/components/admin/BlockedDatesForm'
export const metadata = { title: '日程ブロック | @blueSky 管理' }
export default async function AdminBlockedDatesPage() {
  const { data } = await supabaseAdmin.from('blocked_dates').select('*').order('date')
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">日程ブロック</h1>
      <BlockedDatesForm blocked={data ?? []} />
    </div>
  )
}
