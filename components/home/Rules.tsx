import Link from 'next/link'

const RULES = [
  {
    icon: '✅',
    title: '持ち込み可能',
    items: ['食品・飲料', 'キャンプ道具一式', 'ペット用品'],
  },
  {
    icon: '🐾',
    title: 'ペット',
    items: ['小型動物（全長80㎝程度まで）可', '犬種・頭数は要相談', 'ペットによる損害は利用者負担'],
  },
  {
    icon: '🚫',
    title: '禁止事項',
    items: ['花火・爆竹', '直火（指定焚き火台以外）', '深夜の騒音'],
  },
  {
    icon: '⚠️',
    title: '注意事項',
    items: ['道具・ペットの損害・紛失は利用者負担', '施設損傷は実費請求', '詳細は利用規約参照'],
  },
]

export default function Rules() {
  return (
    <section id="rules" className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">ご利用ルール</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">RULES</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          {RULES.map(rule => (
            <div key={rule.title} className="bg-warm-50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{rule.icon}</span>
                <h3 className="font-bold text-warm-600">{rule.title}</h3>
              </div>
              <ul className="space-y-1">
                {rule.items.map(item => (
                  <li key={item} className="text-sm text-warm-500 flex items-start gap-2">
                    <span className="text-warm-300 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/rules"
            className="inline-flex items-center gap-2 text-warm-400 hover:text-warm-600
                       text-sm border border-warm-200 px-5 py-2 rounded-full
                       hover:border-warm-400 transition-colors"
          >
            利用規約の全文はこちら →
          </Link>
        </div>
      </div>
    </section>
  )
}
