import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { computeTrialBalance } from '@/lib/accounting/trialBalance'
import type { PostedLine } from '@/lib/accounting/trialBalance'
import type { Account, OpeningBalance } from '@/lib/accounting/types'

export const revalidate = 0

const LINKS = [
  { href: '/admin/accounting/reservation-posting', label: '予約売上計上', icon: '💰' },
  { href: '/admin/accounting/expense', label: 'レシート経費入力', icon: '🧾' },
  { href: '/admin/accounting/transfer',   label: '振替入力（消込・チャージ）', icon: '🔄' },
  { href: '/admin/accounting/journal',        label: '仕訳帳',         icon: '📒' },
  { href: '/admin/accounting/ledger',         label: '総勘定元帳',     icon: '📚' },
  { href: '/admin/accounting/trial-balance',  label: '試算表',         icon: '⚖️' },
  { href: '/admin/accounting/accounts',       label: '勘定科目マスタ', icon: '🏷️' },
  { href: '/admin/accounting/opening',        label: '期首残高',       icon: '🌱' },
  { href: '/admin/accounting/inventory-snapshot', label: '期末棚卸', icon: '📦' },
]

export default async function AccountingTop() {
  const year = new Date().getFullYear()
  const { data: accRows } = await supabaseAdmin.from('accounts').select('*')
  const { data: lineRows } = await supabaseAdmin
    .from('journal_lines')
    .select('account_id, side, amount, journal_entries!inner(entry_date)')
    .gte('journal_entries.entry_date', `${year}-01-01`).lte('journal_entries.entry_date', `${year}-12-31`)
  const { data: obRows } = await supabaseAdmin.from('opening_balances').select('*').eq('fiscal_year', year)

  const accounts: Account[] = (accRows ?? []).map(a => ({
    id: a.id, code: a.code, name: a.name, category: a.category,
    normalBalance: a.normal_balance, isActive: a.is_active, sortOrder: a.sort_order,
  }))
  const lines: PostedLine[] = (lineRows ?? []).map(l => ({ accountId: l.account_id, side: l.side, amount: l.amount }))
  const openingBalances: OpeningBalance[] = (obRows ?? []).map(o => ({ accountId: o.account_id, side: o.side, amount: o.amount }))
  const tb = computeTrialBalance(accounts, lines, openingBalances)

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">会計（{year}年）</h1>

      <div className="bg-white border border-warm-100 rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-warm-400 text-xs mb-1">試算表 借貸チェック</p>
          <p className={`font-bold text-lg ${tb.balanced ? 'text-green-600' : 'text-red-500'}`}>
            {tb.balanced ? '✓ 借方=貸方 一致' : '✗ 不一致'}
          </p>
        </div>
        <div className="text-right text-sm text-warm-500">
          <p>借方合計 ¥{tb.totalDebit.toLocaleString()}</p>
          <p>貸方合計 ¥{tb.totalCredit.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}
            className="bg-white border border-warm-100 rounded-xl p-5 hover:shadow-md transition-shadow text-center">
            <div className="text-3xl mb-2">{l.icon}</div>
            <div className="text-warm-700 font-medium">{l.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
