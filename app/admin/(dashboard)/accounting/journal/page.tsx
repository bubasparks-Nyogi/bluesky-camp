import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import JournalEntryForm from '@/components/admin/accounting/JournalEntryForm'

export const revalidate = 0

interface Line { id: string; account_id: string; side: string; amount: number }
interface Entry { id: string; entry_date: string; description: string; journal_lines: Line[] }

export default async function JournalPage() {
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('id, code, name, is_active').order('sort_order').order('code')
  const { data: entries } = await supabaseAdmin
    .from('journal_entries').select('*, journal_lines(*)').order('entry_date', { ascending: false }).limit(100)

  const accountName = (id: string) => accounts?.find(a => a.id === id)?.name ?? '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">仕訳帳</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>

      <JournalEntryForm accounts={accounts ?? []} />

      <div className="space-y-2">
        {(entries as Entry[] ?? []).map(e => (
          <div key={e.id} className="bg-white border border-warm-100 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-warm-500">{e.entry_date}</span>
              <span className="text-warm-700">{e.description}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {e.journal_lines.sort((a, b) => (a.side === 'debit' ? -1 : 1)).map(l => (
                  <tr key={l.id}>
                    <td className="text-warm-400 w-12">{l.side === 'debit' ? '借' : '貸'}</td>
                    <td className="text-warm-700">{accountName(l.account_id)}</td>
                    <td className="text-right text-warm-700">¥{l.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {(!entries || entries.length === 0) && <p className="text-warm-400 text-sm text-center py-8">仕訳はまだありません</p>}
      </div>
    </div>
  )
}
