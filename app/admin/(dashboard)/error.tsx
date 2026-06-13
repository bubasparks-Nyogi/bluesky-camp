'use client'
import { useEffect } from 'react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[AdminError]', error) }, [error])
  return (
    <div className="max-w-md mx-auto bg-white border border-warm-100 rounded-2xl p-6 text-center space-y-3 mt-6">
      <p className="text-3xl">⚠️</p>
      <h1 className="font-serif text-lg text-warm-700">画面の読み込みでエラーが発生しました</h1>
      <p className="text-warm-500 text-sm">時間をおいて再度お試しください。</p>
      {error.digest && (
        <p className="text-warm-300 text-xs">参照番号: {error.digest}</p>
      )}
      <button onClick={reset} className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-5 py-2 rounded-lg">
        再試行
      </button>
    </div>
  )
}
