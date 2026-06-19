import { supabaseAdmin } from '@/lib/supabase'

export default async function Plan() {
  const { data: pricing } = await supabaseAdmin
    .from('pricing').select('item_key, label, amount').eq('active', true).order('amount', { ascending: false })
  const { data: rentals } = await supabaseAdmin
    .from('rental_items').select('id, name, price_per_day, image_url, is_coming_soon, available')
    .or('available.eq.true,is_coming_soon.eq.true')

  return (
    <section id="plan" className="py-20 px-4 bg-warm-50">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">料金</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">PLAN</p>
        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6">
          <div className="bg-warm-300 text-white px-6 py-4">
            <p className="text-xs tracking-widest mb-1">一日一組限定</p>
            <p className="font-serif text-2xl font-bold">基本料金</p>
          </div>
          <div className="p-6">
            {(pricing ?? []).map((p: { item_key: string; label: string; amount: number }) => (
              <div key={p.item_key} className="flex justify-between py-2 border-b border-warm-100 last:border-0 text-sm">
                <span className="text-warm-600">{p.label}</span>
                <span className="font-bold text-warm-500">{p.amount > 0 ? `¥${p.amount.toLocaleString()}` : '無料'}</span>
              </div>
            ))}
          </div>
        </div>
        {rentals && rentals.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="font-serif text-lg text-warm-600 mb-4">道具レンタル（1泊あたり）</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rentals.map((r: { id: string; name: string; price_per_day: number; image_url: string | null; is_coming_soon: boolean; available: boolean }) => (
                <div key={r.id} className="bg-warm-50 rounded-lg overflow-hidden border border-warm-100">
                  <div className="aspect-square bg-warm-100 relative">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-warm-300 text-3xl">📦</div>
                    )}
                    {r.is_coming_soon && (
                      <div className="absolute inset-0 bg-warm-700/60 flex items-center justify-center">
                        <span className="bg-white text-warm-700 text-xs font-bold px-3 py-1 rounded-full">準備中</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-sm text-warm-700 font-medium leading-snug">{r.name}</p>
                    <p className="text-warm-500 text-xs mt-1">
                      {r.is_coming_soon ? '近日提供開始' : `¥${r.price_per_day.toLocaleString()}/泊`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
