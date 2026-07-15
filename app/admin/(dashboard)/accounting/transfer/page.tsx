import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import TransferForm from '@/components/admin/accounting/TransferForm'

export const revalidate = 0

export default async function TransferPage() {
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('id, code, name, category, is_active')
    .eq('is_active', true).order('code')

  const opts = (accounts ?? []).map(a => ({ id: a.id, code: a.code, name: a.name, category: a.category }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">振替入力（消込・チャージ）</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">
        カード引落し（未払金→普通預金）、電子マネーチャージ（電子マネー→普通預金）、
        資金の移動など、借方1・貸方1のシンプルな仕訳を作成します。
      </p>
      <TransferForm accounts={opts} />
    </div>
  )
}
