import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { computeTrialBalance } from '@/lib/accounting/trialBalance'
import type { PostedLine } from '@/lib/accounting/trialBalance'
import type { Account, OpeningBalance } from '@/lib/accounting/types'

export const revalidate = 0

interface Props { searchParams: { year?: string } }

export default async function TrialBalancePage({ searchParams }: Props) {
  const year = Number(searchParams.year) || new Date().getFullYear()

  const { data: accRows } = await supabaseAdmin.from('accounts').select('*').order('sort_order').order('code')
  const { data: lineRows } = await supabaseAdmin
    .from('journal_lines')
    .select('account_id, side, amount, journal_entries!inner(entry_date)')
    .gte('journal_entries.entry_date', `${year}-01-01`)
    .lte('journal_entries.entry_date', `${year}-12-31`)
  const { data: obRows } = await supabaseAdmin.from('opening_balances').select('*').eq('fiscal_year', year)

  const accounts: Account[] = (accRows ?? []).map(a => ({
    id: a.id, code: a.code, name: a.name, category: a.category,
    normalBalance: a.normal_balance, isActive: a.is_active, sortOrder: a.sort_order,
  }))
  const lines: PostedLine[] = (lineRows ?? []).map(l => ({
    accountId: l.account_id, side: l.side, amount: l.amount,
  }))
  const openingBalances: OpeningBalance[] = (obRows ?? []).map(o => ({
    accountId: o.account_id, side: o.side, amount: o.amount,
  }))

  const tb = computeTrialBalance(accounts, lines, openingBalances)
  const visible = tb.rows.filter(r => r.debitTotal !== 0 || r.creditTotal !== 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">試算表（{year}年）</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <table className="w-full text-sm bg-white border border-warm-100 rounded-xl overflow-hidden">
        <thead>
          <tr className="text-warm-400 border-b border-warm-100 text-left">
            <th className="py-2 px-3">科目</th>
            <th className="text-right px-3">借方合計</th>
            <th className="text-right px-3">貸方合計</th>
            <th className="text-right px-3">残高</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.account.id} className="border-b border-warm-50">
              <td className="py-2 px-3 text-warm-700">{r.account.name}</td>
              <td className="text-right px-3 text-warm-600">¥{r.debitTotal.toLocaleString()}</td>
              <td className="text-right px-3 text-warm-600">¥{r.creditTotal.toLocaleString()}</td>
              <td className="text-right px-3 text-warm-700 font-medium">¥{r.balance.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-warm-200 font-bold">
            <td className="py-2 px-3 text-warm-700">合計</td>
            <td className="text-right px-3">¥{tb.totalDebit.toLocaleString()}</td>
            <td className="text-right px-3">¥{tb.totalCredit.toLocaleString()}</td>
            <td className="text-right px-3">{tb.balanced ? '✓ 一致' : '✗ 不一致'}</td>
          </tr>
        </tfoot>
      </table>
      {!tb.balanced && <p className="text-red-500 text-sm mt-3">⚠ 借方合計と貸方合計が一致していません。仕訳を確認してください。</p>}
    </div>
  )
}
