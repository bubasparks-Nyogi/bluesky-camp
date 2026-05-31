import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { computeLedger } from '@/lib/accounting/ledger'
import type { PostedEntry } from '@/lib/accounting/ledger'
import type { Account } from '@/lib/accounting/types'

export const revalidate = 0

interface Props { searchParams: { account?: string; year?: string } }

export default async function LedgerPage({ searchParams }: Props) {
  const year = Number(searchParams.year) || new Date().getFullYear()
  const { data: accRows } = await supabaseAdmin.from('accounts').select('*').order('sort_order').order('code')
  const accounts = accRows ?? []
  const selectedId = searchParams.account || accounts[0]?.id

  let rows: ReturnType<typeof computeLedger> = []
  let selectedAccount: Account | undefined
  let openingBalance = 0

  if (selectedId) {
    const a = accounts.find(x => x.id === selectedId)
    if (a) {
      selectedAccount = {
        id: a.id, code: a.code, name: a.name, category: a.category,
        normalBalance: a.normal_balance, isActive: a.is_active, sortOrder: a.sort_order,
      }
      const { data: ob } = await supabaseAdmin.from('opening_balances')
        .select('side, amount').eq('fiscal_year', year).eq('account_id', selectedId).maybeSingle()
      if (ob) openingBalance = ob.side === selectedAccount.normalBalance ? ob.amount : -ob.amount

      const { data: entryRows } = await supabaseAdmin
        .from('journal_entries')
        .select('entry_date, description, journal_lines(account_id, side, amount)')
        .gte('entry_date', `${year}-01-01`).lte('entry_date', `${year}-12-31`)
        .order('entry_date', { ascending: true })

      const nameById = (id: string) => accounts.find(x => x.id === id)?.name ?? '—'
      const entries: PostedEntry[] = (entryRows ?? []).map(e => ({
        date: e.entry_date, description: e.description,
        lines: (e.journal_lines as { account_id: string; side: 'debit' | 'credit'; amount: number }[])
          .map(l => ({ accountId: l.account_id, side: l.side, amount: l.amount, accountName: nameById(l.account_id) })),
      }))
      rows = computeLedger(selectedId, selectedAccount, entries, openingBalance)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">総勘定元帳（{year}年）</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>

      <form className="mb-4">
        <select name="account" defaultValue={selectedId}
          className="border border-warm-200 rounded-lg px-3 py-2 text-sm">
          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
        </select>
        <button className="ml-2 bg-warm-500 text-white px-4 py-2 rounded-lg text-sm">表示</button>
      </form>

      <table className="w-full text-sm bg-white border border-warm-100 rounded-xl overflow-hidden">
        <thead>
          <tr className="text-warm-400 border-b border-warm-100 text-left">
            <th className="py-2 px-3">日付</th><th className="px-3">摘要</th><th className="px-3">相手科目</th>
            <th className="text-right px-3">借方</th><th className="text-right px-3">貸方</th><th className="text-right px-3">残高</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-warm-50 text-warm-400">
            <td className="py-2 px-3" colSpan={5}>前期繰越</td>
            <td className="text-right px-3">¥{openingBalance.toLocaleString()}</td>
          </tr>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-warm-50">
              <td className="py-2 px-3 text-warm-500">{r.date}</td>
              <td className="px-3 text-warm-700">{r.entryDescription}</td>
              <td className="px-3 text-warm-500">{r.counterAccountName}</td>
              <td className="text-right px-3 text-warm-600">{r.debit ? `¥${r.debit.toLocaleString()}` : ''}</td>
              <td className="text-right px-3 text-warm-600">{r.credit ? `¥${r.credit.toLocaleString()}` : ''}</td>
              <td className="text-right px-3 text-warm-700 font-medium">¥{r.balance.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
