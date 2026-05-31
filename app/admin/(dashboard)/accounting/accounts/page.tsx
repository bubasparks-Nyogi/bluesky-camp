import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import AccountManager from '@/components/admin/accounting/AccountManager'

export const revalidate = 0

export default async function AccountsPage() {
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('*').order('sort_order').order('code')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">勘定科目マスタ</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <AccountManager initialAccounts={accounts ?? []} />
    </div>
  )
}
