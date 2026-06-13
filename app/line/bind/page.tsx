'use client'
import { useEffect, useState } from 'react'

type Status = 'loading' | 'success' | 'error'

const STORAGE_KEY = 'bind_reservationId'

function readReservationIdFromUrl(): string {
  const url = new URL(window.location.href)
  const direct = url.searchParams.get('reservationId')
  if (direct) return direct
  const liffState = url.searchParams.get('liff.state')
  if (liffState) {
    const inner = new URLSearchParams(liffState.replace(/^\?/, ''))
    const id = inner.get('reservationId')
    if (id) return id
  }
  if (url.hash) {
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    const id = hash.get('reservationId')
    if (id) return id
  }
  return ''
}

export default function LineBindPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('LINE連携の設定中...')
  const [liffInstance, setLiffInstance] = useState<typeof import('@line/liff').default | null>(null)

  useEffect(() => {
    let cancelled = false
    // 初回マウントで URL から reservationId を sessionStorage に保存
    // （LIFF login のリダイレクトで query が失われるため）
    const initialId = readReservationIdFromUrl()
    if (initialId) sessionStorage.setItem(STORAGE_KEY, initialId)

    ;(async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID
        if (!liffId) throw new Error('LIFF_ID が未設定です')
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId })
        if (cancelled) return
        if (!liff.isLoggedIn()) { liff.login(); return }
        // login 後の戻り場合は URL を再確認 + sessionStorage を最終 fallback
        const reservationId =
          readReservationIdFromUrl() ||
          sessionStorage.getItem(STORAGE_KEY) ||
          ''
        if (!reservationId) throw new Error('予約番号が見つかりません')
        const profile = await liff.getProfile()
        const idToken = liff.getIDToken()
        if (!idToken) throw new Error('idToken 取得失敗')
        const res = await fetch('/api/line/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId, lineUserId: profile.userId, idToken }),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) throw new Error(json.error ?? '連携に失敗しました')
        if (cancelled) return
        setLiffInstance(liff as unknown as typeof import('@line/liff').default)
        setStatus('success')
        setMessage('連携完了！')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setMessage(e instanceof Error ? e.message : '不明なエラー')
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="min-h-screen bg-warm-50 px-4 py-12">
      <div className="max-w-md mx-auto bg-white border border-warm-100 rounded-2xl p-8 text-center space-y-4">
        <h1 className="font-serif text-2xl text-warm-700">@blueSky</h1>
        {status === 'loading' && (
          <>
            <p className="text-warm-500 text-sm">{message}</p>
            <p className="text-3xl">⏳</p>
          </>
        )}
        {status === 'success' && (
          <>
            <p className="text-warm-700 text-lg">✅ {message}</p>
            <p className="text-warm-500 text-sm">これでLINEから直接ご連絡いただけます。当日の追加注文・質問もこちらへどうぞ。</p>
            <button
              onClick={() => liffInstance?.closeWindow()}
              className="inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-5 py-2 rounded-lg"
            >
              LINEに戻る
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-500 text-lg">⚠️ 連携できませんでした</p>
            <p className="text-warm-500 text-sm">{message}</p>
            <p className="text-warm-400 text-xs">オーナーまでご連絡ください。</p>
          </>
        )}
      </div>
    </main>
  )
}
