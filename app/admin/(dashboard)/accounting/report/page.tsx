import { supabaseAdmin } from '@/lib/supabase'
import { aggregatePeriod, type JournalLineRow } from '@/lib/accounting/aggregatePeriod'
import { applyTaxMapping } from '@/lib/accounting/applyTaxMapping'
import PeriodSelector from './PeriodSelector'

export const dynamic = 'force-dynamic'

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

const yen = (n: number) => `¥${n.toLocaleString()}`

interface SP { year?: string; month?: string }

export default async function ReportPage({ searchParams }: { searchParams: SP }) {
  const now = new Date()
  const year = Number(searchParams.year ?? now.getFullYear())
  const month = searchParams.month ? Number(searchParams.month) : null
  const periodStart = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`
  const periodEnd   = month ? lastDayOfMonth(year, month) : `${year}-12-31`

  const { data } = await supabaseAdmin
    .from('journal_lines')
    .select(`
      side, amount,
      journal_entries!inner(entry_date),
      accounts!inner(id, code, name, category, normal_balance)
    `)
    .lte('journal_entries.entry_date', periodEnd)

  const lines: JournalLineRow[] = (data ?? []).map((row: Record<string, unknown>) => {
    const e = row.journal_entries as { entry_date: string }
    const a = row.accounts as { id: string; code: string; name: string; category: JournalLineRow['account_category']; normal_balance: 'debit' | 'credit' }
    return {
      account_id: a.id, account_code: a.code, account_name: a.name,
      account_category: a.category, normal_balance: a.normal_balance,
      side: row.side as 'debit' | 'credit', amount: row.amount as number, entry_date: e.entry_date,
    }
  })

  const agg = aggregatePeriod(lines, periodStart, periodEnd)
  const report = applyTaxMapping(agg.accounts, agg.totals.netIncome)

  const periodLabel = month ? `${year}年${month}月` : `${year}年`
  const periodEndLabel = month ? `${year}年${month}月末時点` : `${year}年12月末時点`

  const assetsTotal      = report.bsAssets.reduce((s, r) => s + r.amount, 0)
  const liabilitiesTotal = report.bsLiabilities.reduce((s, r) => s + r.amount, 0)
  const equityTotal      = report.bsEquity.reduce((s, r) => s + r.amount, 0)
  const bsImbalance      = assetsTotal !== liabilitiesTotal + equityTotal

  const availableYears = (() => {
    const y = now.getFullYear()
    return [y - 4, y - 3, y - 2, y - 1, y, y + 1]
  })()

  const hasData = lines.length > 0

  return (
    <main className="min-h-screen bg-warm-50 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-warm-700 font-serif text-2xl mb-2">📊 決算書</h1>
        <PeriodSelector availableYears={availableYears} />

        {report.unmapped.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 text-sm text-warm-700">
            ⚠ 未分類の科目: {report.unmapped.map(u => `${u.name}(${u.code})`).join(', ')}
          </div>
        )}

        {!hasData ? (
          <p className="text-warm-400 text-sm py-10 text-center">対象期間に取引がありません</p>
        ) : (
          <>
            <section className="bg-white border border-warm-100 rounded-2xl p-5 mb-5">
              <h2 className="font-bold text-warm-700 mb-3">損益計算書（{periodLabel}）</h2>
              <div className="flex justify-between py-1">
                <span>{report.revenue.label}</span>
                <span className="font-bold">{yen(report.revenue.amount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>{report.purchases.label}</span>
                <span className="font-bold">−{yen(report.purchases.amount)}</span>
              </div>
              <hr className="my-2 border-warm-100" />
              <div className="flex justify-between py-1 font-bold text-warm-700">
                <span>差引金額</span>
                <span>{yen(report.revenue.amount - report.purchases.amount)}</span>
              </div>

              <h3 className="mt-4 mb-2 text-warm-500 text-sm font-bold">経費</h3>
              {report.expenses.filter(e => e.amount !== 0).map(e => (
                <div key={e.key} className="flex justify-between py-0.5 pl-2 text-sm">
                  <span>{e.label}</span>
                  <span>{yen(e.amount)}</span>
                </div>
              ))}
              <hr className="my-2 border-warm-100" />
              <div className="flex justify-between py-1 font-bold">
                <span>経費計</span>
                <span>{yen(report.expenses.reduce((s, e) => s + e.amount, 0))}</span>
              </div>
              <div className="flex justify-between py-2 mt-3 text-warm-700 font-bold text-lg border-t border-warm-300">
                <span>所得金額</span>
                <span>{yen(agg.totals.netIncome)}</span>
              </div>
            </section>

            <section className="bg-white border border-warm-100 rounded-2xl p-5">
              <h2 className="font-bold text-warm-700 mb-3">貸借対照表（{periodEndLabel}）</h2>
              {bsImbalance && (
                <p className="text-red-500 text-sm mb-2">⚠ 借方 ≠ 貸方（仕訳に不整合の可能性）</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-warm-500 text-sm font-bold mb-2">資産の部</h3>
                  {report.bsAssets.filter(r => r.amount !== 0).map(r => (
                    <div key={r.key} className="flex justify-between py-0.5 pl-2 text-sm">
                      <span>{r.label}</span>
                      <span>{yen(r.amount)}</span>
                    </div>
                  ))}
                  <hr className="my-2 border-warm-100" />
                  <div className="flex justify-between py-1 font-bold">
                    <span>資産計</span>
                    <span>{yen(assetsTotal)}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-warm-500 text-sm font-bold mb-2">負債の部</h3>
                  {report.bsLiabilities.filter(r => r.amount !== 0).map(r => (
                    <div key={r.key} className="flex justify-between py-0.5 pl-2 text-sm">
                      <span>{r.label}</span>
                      <span>{yen(r.amount)}</span>
                    </div>
                  ))}
                  <hr className="my-2 border-warm-100" />
                  <div className="flex justify-between py-1 font-bold">
                    <span>負債計</span>
                    <span>{yen(liabilitiesTotal)}</span>
                  </div>

                  <h3 className="text-warm-500 text-sm font-bold mt-4 mb-2">資本の部</h3>
                  {report.bsEquity.filter(r => r.amount !== 0).map(r => (
                    <div key={r.key} className="flex justify-between py-0.5 pl-2 text-sm">
                      <span>{r.label}</span>
                      <span>{yen(r.amount)}</span>
                    </div>
                  ))}
                  <hr className="my-2 border-warm-100" />
                  <div className="flex justify-between py-1 font-bold">
                    <span>資本計</span>
                    <span>{yen(equityTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 mt-2 font-bold text-warm-700 border-t border-warm-300">
                    <span>負債・資本計</span>
                    <span>{yen(liabilitiesTotal + equityTotal)}</span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
