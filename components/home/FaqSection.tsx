// components/home/FaqSection.tsx
'use client'
import { useState } from 'react'

const CATEGORY_LABELS: Record<string, string> = {
  general:  'よくある質問',
  pricing:  '料金について',
  access:   'アクセス・送迎',
  facility: '設備・施設',
}

interface Faq {
  id:       string
  question: string
  answer:   string
  category: string
}

interface Props {
  faqs: Faq[]
}

export default function FaqSection({ faqs }: Props) {
  const [openId,    setOpenId]    = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('general')

  if (faqs.length === 0) return null

  const categories = Array.from(new Set(faqs.map(f => f.category)))
  const filtered   = faqs.filter(f => f.category === activeTab)

  return (
    <section id="faq" className="py-20 px-4 bg-warm-50">
      <div className="max-w-2xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">よくある質問</h2>
        <p className="text-center text-warm-400 mb-10 text-sm tracking-widest">FAQ</p>

        {/* カテゴリタブ */}
        <div className="flex gap-2 flex-wrap mb-8 justify-center">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === cat
                  ? 'bg-warm-300 text-white'
                  : 'bg-white text-warm-500 border border-warm-200 hover:bg-warm-100'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>

        {/* アコーディオン */}
        <div className="space-y-2">
          {filtered.map(faq => (
            <div key={faq.id} className="bg-white rounded-xl border border-warm-200 overflow-hidden">
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full text-left px-5 py-4 flex justify-between items-center gap-4"
              >
                <span className="text-sm font-medium text-warm-700">{faq.question}</span>
                <span className="text-warm-400 text-lg shrink-0">
                  {openId === faq.id ? '−' : '+'}
                </span>
              </button>
              {openId === faq.id && (
                <div className="px-5 pb-4 text-sm text-warm-500 leading-relaxed border-t border-warm-100 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
