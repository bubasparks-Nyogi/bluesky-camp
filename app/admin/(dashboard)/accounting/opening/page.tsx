import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import OpeningBalanceForm from '@/components/admin/accounting/OpeningBalanceForm'

export const revalidate = 0

interface Props { searchParams: { year?: string } }

export default async function OpeningPage({ searchParams }: Props) {
  const year = Number(searchParams.year) || new Date().getFullYear()
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('id, code, name, normal_balance').eq('is_active', true).order('sort_order').order('code')
  const { data: initial } = await supabaseAdmin
    .from('opening_balances').select('account_id, side, amount').eq('fiscal_year', year)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">期首残高（{year}年）</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">各科目の期首残高を入力します。開業初年度は元入金などを設定してください。</p>
      <OpeningBalanceForm accounts={accounts ?? []} year={year} initial={initial ?? []} />
    </div>
  )
}
