'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { buildSearch } from '@/lib/admin-filter-params'

const PUBLISH_OPTIONS = [
  { value: 'all',         label: 'すべて' },
  { value: 'published',   label: '公開中のみ' },
  { value: 'unpublished', label: '未承認のみ' },
]

interface Props { totalCount: number; visibleCount: number }

export default function ReviewFilters({ totalCount, visibleCount }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [q,       setQ]       = useState(sp.get('q')       ?? '')
  const [publish, setPublish] = useState(sp.get('publish') ?? 'all')

  const debouncedQ = useDebouncedValue(q, 300)

  useEffect(() => {
    const search = buildSearch({
      q:       debouncedQ || undefined,
      publish: publish === 'all' ? undefined : publish,
    })
    router.replace(`/admin/reviews${search}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, publish])

  const clear = () => { setQ(''); setPublish('all') }
  const hasActiveFilters = !!(q || publish !== 'all')

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 mb-6">
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 ゲスト名 / コメント検索"
          className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
        <select value={publish} onChange={e => setPublish(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {PUBLISH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-warm-500"><strong className="text-warm-700">{visibleCount}</strong> / 全 {totalCount} 件</span>
        {hasActiveFilters && <button type="button" onClick={clear} className="text-warm-500 hover:text-warm-700 underline">フィルタをクリア</button>}
      </div>
    </div>
  )
}
