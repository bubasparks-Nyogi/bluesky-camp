// components/admin/ReservationEditForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReservationRow, StayType, ReservationStatus, PricingItem } from '@/types/reservation'
import { calcTotal, calcNights } from '@/lib/pricing'

const STAY_OPTIONS: { value: StayType; label: string }[] = [
  { value: 'tent',      label: 'テント設営' },
  { value: 'trailer_a', label: 'トレーラーA' },
  { value: 'trailer_b', label: 'トレーラーB' },
  { value: 'campervan', label: 'キャンピングカー乗り入れ' },
]

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'pending',   label: '確認中' },
  { value: 'confirmed', label: '確定' },
  { value: 'cancelled', label: 'キャンセル' },
]

interface Props {
  reservation: ReservationRow
  pricing:     PricingItem[]
}

export default function ReservationEditForm({ reservation: init, pricing }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    checkin_date:     init.checkin_date,
    checkout_date:    init.checkout_date,
    stay_types:       (Array.isArray(init.stay_types) && init.stay_types.length
      ? init.stay_types
      : [init.stay_type]) as StayType[],
    ehu:              init.ehu,
    sauna:            init.sauna,
    pet:              init.pet,
    transfer_count:   init.transfer_count,
    transfer_station: init.transfer_station ?? '',
    guest_name:       init.guest_name,
    guest_email:      init.guest_email,
    guest_phone:      init.guest_phone,
    total_amount:     init.total_amount,
    status:           init.status,
    payment_method:   (init as { payment_method?: string }).payment_method ?? '',
    paid_at:          (init as { paid_at?: string }).paid_at ?? '',
    manualAmount:     false as boolean,   // true のとき自動再計算しない
  })
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // 宿泊タイプ・日程が変わったら自動再計算
  const recalc = (next: typeof form) => {
    if (next.manualAmount) return next
    const totalAmount = calcTotal(
      {
        checkinDate:     next.checkin_date,
        checkoutDate:    next.checkout_date,
        stayTypes:       next.stay_types,
        ehu:             next.ehu,
        sauna:           next.sauna,
        pet:             next.pet,
        transferCount:   next.transfer_count,
        transferStation: next.transfer_station,
        rentalItems:     init.rental_items ?? [],
        guestName:       '',
        guestEmail:      '',
        guestPhone:      '',
      },
      pricing,
    )
    return { ...next, total_amount: totalAmount }
  }

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => recalc({ ...prev, [key]: value }))
  }

  const toggleStayType = (t: StayType) => {
    setForm(prev => {
      const next = prev.stay_types.includes(t)
        ? prev.stay_types.filter(v => v !== t)
        : [...prev.stay_types, t]
      return recalc({ ...prev, stay_types: next })
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const res = await fetch(`/api/admin/reservations/${init.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...form,
        stay_type: form.stay_types[0] ?? 'tent',  // 後方互換
      }),
    })
    if (res.ok) {
      const payRes = await fetch(`/api/admin/reservations/${init.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: form.payment_method || null,
          paid_at:        form.payment_method === 'prepaid' ? (form.paid_at || null) : null,
        }),
      })
      const payJson = await payRes.json().catch(() => ({}))
      if (!payRes.ok) {
        setSaving(false)
        setMessage(`支払情報の保存に失敗しました: ${payJson.error ?? ''}`)
        return
      }
      if (payJson.postingError) {
        setSaving(false)
        setMessage(`保存しました（注意：前受金仕訳の自動生成に失敗 → ${payJson.postingError}。会計画面で確認してください）`)
        return
      }
      setSaving(false)
      setMessage('保存しました')
      setTimeout(() => router.push('/admin/reservations'), 1000)
    } else {
      setSaving(false)
      const d = await res.json()
      setMessage(`保存に失敗しました: ${d.error}`)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm border ${
          message.startsWith('保存しました')
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>{message}</div>
      )}

      {/* 日程 */}
      <section className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-medium text-warm-600 mb-4 text-sm">日程</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-400 mb-1">チェックイン</label>
            <input type="date" value={form.checkin_date}
                   onChange={e => update('checkin_date', e.target.value)}
                   className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400" />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">チェックアウト</label>
            <input type="date" value={form.checkout_date}
                   onChange={e => update('checkout_date', e.target.value)}
                   className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400" />
          </div>
        </div>
      </section>

      {/* 宿泊タイプ */}
      <section className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-medium text-warm-600 mb-3 text-sm">宿泊タイプ</h3>
        <div className="grid grid-cols-2 gap-2">
          {STAY_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.stay_types.includes(opt.value)}
                     onChange={() => toggleStayType(opt.value)}
                     className="w-4 h-4 accent-warm-300" />
              <span className="text-sm text-warm-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* オプション */}
      <section className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-medium text-warm-600 mb-3 text-sm">オプション</h3>
        <div className="space-y-2">
          {(['sauna', 'pet', 'ehu'] as const).map(key => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[key]}
                     onChange={e => update(key, e.target.checked)}
                     className="w-4 h-4 accent-warm-300" />
              <span className="text-sm text-warm-700">
                {key === 'sauna' ? 'サウナ' : key === 'pet' ? 'ペット同伴' : 'EHU（電源フック）'}
              </span>
            </label>
          ))}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-warm-400 mb-1">送迎人数</label>
              <input type="number" min={0} value={form.transfer_count}
                     onChange={e => update('transfer_count', Number(e.target.value))}
                     className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400" />
            </div>
            <div>
              <label className="block text-xs text-warm-400 mb-1">送迎駅</label>
              <input type="text" value={form.transfer_station}
                     onChange={e => update('transfer_station', e.target.value)}
                     className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400" />
            </div>
          </div>
        </div>
      </section>

      {/* お客様情報 */}
      <section className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-medium text-warm-600 mb-3 text-sm">お客様情報</h3>
        <div className="space-y-3">
          {([
            ['guest_name',  'お名前',         'text'],
            ['guest_email', 'メールアドレス', 'email'],
            ['guest_phone', '電話番号',       'tel'],
          ] as const).map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-xs text-warm-400 mb-1">{label}</label>
              <input type={type} value={form[key]}
                     onChange={e => update(key, e.target.value)}
                     className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400" />
            </div>
          ))}
        </div>
      </section>

      {/* 金額・ステータス */}
      <section className="bg-white rounded-xl border border-warm-200 p-5">
        <h3 className="font-medium text-warm-600 mb-3 text-sm">金額・ステータス</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-warm-400 mb-1">
              合計金額（円）
              <label className="ml-2 cursor-pointer">
                <input type="checkbox" checked={form.manualAmount}
                       onChange={e => update('manualAmount', e.target.checked)}
                       className="mr-1 accent-warm-300" />
                <span className="text-warm-300">手動</span>
              </label>
            </label>
            <input type="number" value={form.total_amount}
                   disabled={!form.manualAmount}
                   onChange={e => update('total_amount', Number(e.target.value))}
                   className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400 disabled:bg-warm-50" />
            {!form.manualAmount && (
              <p className="text-xs text-warm-400 mt-1">自動計算中</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">ステータス</label>
            <select value={form.status}
                    onChange={e => update('status', e.target.value as ReservationStatus)}
                    className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400">
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">支払方法</label>
            <select
              value={form.payment_method}
              onChange={e => setForm({ ...form, payment_method: e.target.value })}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">未設定</option>
              <option value="onsite">現地払い</option>
              <option value="prepaid">事前振込</option>
            </select>
          </div>
          {form.payment_method === 'prepaid' && (
            <div>
              <label className="block text-sm text-warm-500 mb-1">入金日</label>
              <input
                type="date"
                value={form.paid_at}
                onChange={e => setForm({ ...form, paid_at: e.target.value })}
                className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-warm-300 text-xs mt-1">入金日を保存すると前受金の仕訳が自動計上されます。</p>
            </div>
          )}
        </div>
      </section>

      <div className="flex gap-3">
        <button onClick={() => router.push('/admin/reservations')}
                className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">
          ← 戻る
        </button>
        <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors text-base">
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}
