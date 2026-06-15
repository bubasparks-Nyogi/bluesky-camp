import { supabaseAdmin } from '@/lib/supabase'
import SiteSettingsForm from './SiteSettingsForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'サイト設定 | @blueSky 管理' }

export default async function SiteSettingsPage() {
  const { data } = await supabaseAdmin
    .from('site_settings').select('*').eq('id', 1).maybeSingle()
  const initial = {
    checkin_time:  data?.checkin_time  ?? '',
    checkout_time: data?.checkout_time ?? '',
    address:       data?.address       ?? '',
    phone:         data?.phone         ?? '',
    guide_note:    data?.guide_note    ?? '',
    access_note:   data?.access_note   ?? '',
  }
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-2">⚙️ サイト設定</h1>
      <p className="text-warm-400 text-sm mb-6">予約確認メールに掲載される営業情報を編集できます。</p>
      <SiteSettingsForm initial={initial} />
    </div>
  )
}
