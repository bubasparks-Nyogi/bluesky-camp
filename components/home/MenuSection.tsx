interface MenuItem {
  id: string
  name: string
  category: string
  unit: string
  sale_price: number | null
  display_status: 'available' | 'sold_out' | 'coming_soon'
}

interface Props {
  items: MenuItem[]
}

const CATEGORY_LABEL: Record<string, string> = {
  dish:  '料理',
  drink: 'ドリンク',
  goods: '物販',
  supply: '消耗品',
  ingredient: '食材',
}
const CATEGORY_ORDER = ['dish', 'drink', 'goods', 'supply', 'ingredient']

const STATUS_BADGE: Record<'sold_out' | 'coming_soon', { label: string; cls: string }> = {
  sold_out:    { label: '売り切れ', cls: 'bg-red-500 text-white' },
  coming_soon: { label: '準備中',   cls: 'bg-blue-500 text-white' },
}

export default function MenuSection({ items }: Props) {
  if (items.length === 0) return null

  const grouped = new Map<string, MenuItem[]>()
  for (const it of items) {
    const arr = grouped.get(it.category) ?? []
    arr.push(it)
    grouped.set(it.category, arr)
  }
  const orderedCategories = CATEGORY_ORDER.filter(c => grouped.has(c))
    .concat(Array.from(grouped.keys()).filter(c => !CATEGORY_ORDER.includes(c)))

  return (
    <section id="menu" className="py-20 px-4 bg-warm-100">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">メニュー</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">MENU</p>

        <div className="space-y-10">
          {orderedCategories.map(cat => (
            <div key={cat}>
              <h3 className="font-serif text-lg text-warm-600 border-b border-warm-300 pb-2 mb-4">
                {CATEGORY_LABEL[cat] ?? cat}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {grouped.get(cat)!.map(it => {
                  const unavailable = it.display_status !== 'available'
                  const badge = it.display_status !== 'available' ? STATUS_BADGE[it.display_status] : null
                  return (
                    <div key={it.id}
                      className={`bg-white rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm ${unavailable ? 'opacity-70' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-serif text-warm-700 ${unavailable ? 'line-through' : ''}`}>{it.name}</span>
                          {badge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                      </div>
                      {it.sale_price != null && (
                        <span className={`font-bold text-warm-600 tabular-nums shrink-0 ${unavailable ? 'text-warm-400' : ''}`}>
                          ¥{it.sale_price.toLocaleString()}
                          <span className="text-[10px] text-warm-400 ml-0.5">/ {it.unit}</span>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-warm-400 mt-8">
          ※メニュー内容・価格は仕入状況により変更する場合があります
        </p>
      </div>
    </section>
  )
}
