import { supabase } from '@/lib/supabase'

export default async function Plan() {
  const { data: pricing } = await supabase
    .from('pricing').select('item_key, label, amount').eq('active', true).order('amount', { ascending: false })
  const { data: rentals } = await supabase
    .from('rental_items').select('id, name, price_per_day').eq('available', true)

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
                <span className="font-bold text-warm-500">¥{p.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
        {rentals && rentals.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="font-serif text-lg text-warm-600 mb-4">道具レンタル（1泊あたり）</h3>
            <div className="grid grid-cols-2 gap-2">
              {rentals.map((r: { id: string; name: string; price_per_day: number }) => (
                <div key={r.id} className="flex justify-between text-sm py-1">
                  <span className="text-warm-500">{r.name}</span>
                  <span className="text-warm-400">¥{r.price_per_day.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
