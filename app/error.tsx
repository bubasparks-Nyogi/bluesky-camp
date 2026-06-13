'use client'
import { useEffect } from 'react'

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[RootError]', error) }, [error])
  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-warm-100 rounded-2xl p-8 text-center space-y-4">
        <p className="text-3xl">⚠️</p>
        <h1 className="font-serif text-xl text-warm-700">エラーが発生しました</h1>
        <p className="text-warm-500 text-sm">画面の読み込み中に問題が起きました。時間をおいて再度お試しください。</p>
        {error.digest && (
          <p className="text-warm-300 text-xs">参照番号: {error.digest}</p>
        )}
        <button onClick={reset} className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-5 py-2 rounded-lg">
          再試行
        </button>
      </div>
    </div>
  )
}
