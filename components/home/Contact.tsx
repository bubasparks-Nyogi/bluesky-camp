'use client'
import { useState } from 'react'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState<'idle'|'sending'|'done'|'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setStatus(res.ok ? 'done' : 'error')
  }

  return (
    <section id="contact" className="py-20 px-4 bg-warm-600">
      <div className="max-w-lg mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-white text-center mb-2">お問い合わせ</h2>
        <p className="text-center text-warm-200 mb-10 text-sm tracking-widest">CONTACT</p>
        {status === 'done' ? (
          <div className="text-center text-white"><p className="text-2xl mb-2">✓</p><p>送信しました。お返事をお待ちください。</p></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required type="text" placeholder="お名前" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-warm-500 text-white placeholder-warm-300 border border-warm-400 focus:outline-none focus:border-warm-200 text-sm" />
            <input required type="email" placeholder="メールアドレス" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-warm-500 text-white placeholder-warm-300 border border-warm-400 focus:outline-none focus:border-warm-200 text-sm" />
            <textarea required rows={5} placeholder="お問い合わせ内容" value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-warm-500 text-white placeholder-warm-300 border border-warm-400 focus:outline-none focus:border-warm-200 text-sm resize-none" />
            {status === 'error' && <p className="text-red-300 text-sm">送信に失敗しました。再度お試しください。</p>}
            <button type="submit" disabled={status === 'sending'}
              className="w-full bg-warm-300 hover:bg-warm-200 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-60 text-sm">
              {status === 'sending' ? '送信中...' : '送信する'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
