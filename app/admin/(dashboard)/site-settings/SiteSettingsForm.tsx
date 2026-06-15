'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Initial {
  checkin_time: string
  checkout_time: string
  address: string
  phone: string
  guide_note: string
  access_note: string
}

export default function SiteSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter()
  const [form, setForm] = useState({
    checkinTime:  initial.checkin_time,
    checkoutTime: initial.checkout_time,
    address:      initial.address,
    phone:        initial.phone,
    guideNote:    initial.guide_note,
    accessNote:   initial.access_note,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null); setErr(null)
    const res = await fetch('/api/admin/site-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setBusy(false)
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? '保存に失敗しました'); return }
    setMsg('保存しました ✨')
    router.refresh()
  }

  const label = 'text-warm-500 text-sm block mb-1'
  const input = 'w-full border border-warm-200 rounded px-3 py-2'

  return (
    <form onSubmit={save} className="space-y-4 max-w-xl">
      <div>
        <label className={label}>チェックイン時間</label>
        <input className={input} value={form.checkinTime} onChange={update('checkinTime')} placeholder="例: 12:00 〜 17:00" />
      </div>
      <div>
        <label className={label}>チェックアウト時間</label>
        <input className={input} value={form.checkoutTime} onChange={update('checkoutTime')} placeholder="例: 10:00 まで" />
      </div>
      <div>
        <label className={label}>所在地</label>
        <input className={input} value={form.address} onChange={update('address')} placeholder="例: 滋賀県高島市..." />
      </div>
      <div>
        <label className={label}>緊急連絡先（電話）</label>
        <input className={input} value={form.phone} onChange={update('phone')} placeholder="例: 090-XXXX-XXXX" />
      </div>
      <div>
        <label className={label}>ご利用案内（任意）<span className="text-warm-300 text-xs ml-2">持ち物・施設・チェックイン手順など。改行はそのまま反映されます。</span></label>
        <textarea className={`${input} min-h-[140px]`} value={form.guideNote} onChange={update('guideNote')} placeholder="例：\n・受付は管理棟で行います\n・お風呂は18:00〜22:00 ..." />
      </div>
      <div>
        <label className={label}>アクセス案内（任意）<span className="text-warm-300 text-xs ml-2">/access ページに表示。電車・車・周辺観光など。</span></label>
        <textarea className={`${input} min-h-[140px]`} value={form.accessNote} onChange={update('accessNote')} placeholder="例：\n【お車の場合】\n名神京都東ICから約1時間\n\n【電車の場合】\nJR近江高島駅からタクシー約10分\n\n【周辺観光】\n白髭神社、メタセコイア並木 ..." />
      </div>

      {err && <p className="text-red-500 text-sm">{err}</p>}
      {msg && <p className="text-green-600 text-sm">{msg}</p>}

      <button type="submit" disabled={busy}
        className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-5 py-2 rounded-lg disabled:opacity-50">
        {busy ? '保存中...' : '保存'}
      </button>
    </form>
  )
}
