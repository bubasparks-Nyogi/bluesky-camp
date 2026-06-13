import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-warm-100 rounded-2xl p-8 text-center space-y-4">
        <p className="text-3xl">🏕</p>
        <h1 className="font-serif text-xl text-warm-700">ページが見つかりません</h1>
        <p className="text-warm-500 text-sm">URL に誤りがあるか、すでに削除されたページです。</p>
        <Link href="/" className="inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-5 py-2 rounded-lg">
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}
