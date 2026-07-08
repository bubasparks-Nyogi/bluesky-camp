import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import ExpenseReceiptForm from '@/components/admin/accounting/ExpenseReceiptForm'

export const revalidate = 0

const PAYMENT_CODES = ['101', '102', '202', '303']

export default async function ExpensePage() {
  const [{ data: accounts }, { data: items }] = await Promise.all([
    supabaseAdmin.from('accounts').select('id, code, name, category, is_active').eq('is_active', true).order('code'),
    supabaseAdmin.from('items').select('id, name, unit, category, track_inventory, is_active').eq('is_active', true).order('name'),
  ])

  const expenseAccounts = (accounts ?? [])
    .filter(a => a.category === 'expense')
    .map(a => ({ id: a.id, code: a.code, name: a.name }))
  const paymentAccounts = (accounts ?? [])
    .filter(a => PAYMENT_CODES.includes(a.code))
    .map(a => ({ id: a.id, code: a.code, name: a.name }))
  const itemMaster = (items ?? []).map(i => ({
    id: i.id, name: i.name, unit: i.unit, category: i.category, trackInventory: Boolean(i.track_inventory),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">レシート経費入力</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">レシートを撮影/選択して読み取り、明細を確認して記帳します。商品マスタに紐付けた行は在庫が自動加算されます。</p>
      <ExpenseReceiptForm expenseAccounts={expenseAccounts} paymentAccounts={paymentAccounts} itemMaster={itemMaster} />
    </div>
  )
}
