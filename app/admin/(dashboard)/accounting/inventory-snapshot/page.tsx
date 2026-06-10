import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import InventorySnapshotManager from '@/components/admin/accounting/InventorySnapshotManager'

export const revalidate = 0

export default async function InventorySnapshotPage() {
  const { data: snaps } = await supabaseAdmin
    .from('inventory_snapshots').select('*')
    .order('fiscal_year', { ascending: false }).order('snapshot_type')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">期末棚卸</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">
        年末に「期末棚卸」を実行すると、在庫評価額（数量 × 原価）を計算し、繰越商品 / 仕入高 の振替仕訳が自動生成されます（三分法）。翌年1月1日に「期首振替」を実行して仕入高に戻します。
      </p>
      <InventorySnapshotManager initialSnaps={snaps ?? []} />
    </div>
  )
}
