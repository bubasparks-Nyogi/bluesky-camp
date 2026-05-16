// components/admin/FaqManager.tsx
'use client'
import { useState } from 'react'

const CATEGORIES = [
  { value: 'general',  label: 'よくある質問' },
  { value: 'pricing',  label: '料金について' },
  { value: 'access',   label: 'アクセス・送迎' },
  { value: 'facility', label: '設備・施設' },
]

interface Faq {
  id:           string
  question:     string
  answer:       string
  category:     string
  sort_order:   number
  is_published: boolean
}

const EMPTY: Omit<Faq, 'id'> = {
  question: '', answer: '', category: 'general', sort_order: 0, is_published: true,
}

export default function FaqManager({ initialFaqs }: { initialFaqs: Faq[] }) {
  const [faqs,    setFaqs]    = useState<Faq[]>(initialFaqs)
  const [form,    setForm]    = useState<Omit<Faq, 'id'>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)

    if (editing) {
      await fetch(`/api/admin/faqs/${editing}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      setFaqs(prev => prev.map(f => f.id === editing ? { ...f, ...form } : f))
      setEditing(null)
    } else {
      const res  = await fetch('/api/admin/faqs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, sort_order: faqs.length }),
      })
      const data = await res.json()
      if (res.ok) setFaqs(prev => [...prev, data.faq])
    }

    setForm(EMPTY)
    setSaving(false)
  }

  const handleEdit = (faq: Faq) => {
    setEditing(faq.id)
    setForm({
      question:     faq.question,
      answer:       faq.answer,
      category:     faq.category,
      sort_order:   faq.sort_order,
      is_published: faq.is_published,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このFAQを削除しますか？')) return
    await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE' })
    setFaqs(prev => prev.filter(f => f.id !== id))
  }

  const handleTogglePublish = async (faq: Faq) => {
    await fetch(`/api/admin/faqs/${faq.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_published: !faq.is_published }),
    })
    setFaqs(prev => prev.map(f =>
      f.id === faq.id ? { ...f, is_published: !f.is_published } : f
    ))
  }

  return (
    <div className="space-y-6">
      {/* 追加・編集フォーム */}
      <div className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-bold text-warm-700 mb-4">{editing ? 'FAQ を編集' : '新しい FAQ を追加'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-warm-400 mb-1">カテゴリ</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">質問</label>
            <input
              type="text" value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              placeholder="質問を入力..."
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">回答</label>
            <textarea
              value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              rows={3} placeholder="回答を入力..."
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 bg-white focus:outline-none focus:border-warm-400 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.question || !form.answer}
              className="bg-warm-300 hover:bg-warm-400 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {saving ? '保存中...' : editing ? '更新する' : '追加する'}
            </button>
            {editing && (
              <button
                onClick={() => { setEditing(null); setForm(EMPTY) }}
                className="border border-warm-200 text-warm-500 px-4 py-2 rounded-lg text-sm"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FAQ一覧 */}
      <div className="overflow-x-auto rounded-xl border border-warm-200">
        <table className="w-full text-sm">
          <thead className="bg-warm-100 text-warm-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">質問</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">カテゴリ</th>
              <th className="px-4 py-3 text-center font-medium">公開</th>
              <th className="px-4 py-3 text-center font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map(faq => (
              <tr key={faq.id} className="border-t border-warm-100 hover:bg-warm-50">
                <td className="px-4 py-3 text-warm-700 max-w-xs truncate">{faq.question}</td>
                <td className="px-4 py-3 text-warm-500 hidden md:table-cell">
                  {CATEGORIES.find(c => c.value === faq.category)?.label}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleTogglePublish(faq)}
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      faq.is_published ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-400'
                    }`}
                  >
                    {faq.is_published ? '公開' : '非公開'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleEdit(faq)}
                    className="text-xs text-warm-500 hover:text-warm-700 border border-warm-200 px-2 py-1 rounded mr-1"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {faqs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-warm-400">FAQがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
