import Link from 'next/link'
export const metadata = { title: 'ご予約完了 | @blueSky' }
export default function CompletePage({ searchParams }: { searchParams: { id?: string } }) {
  const reservationId = searchParams.id ?? ''
  return (
    <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6">🔥</div>
        <h1 className="font-serif text-2xl text-warm-600 font-bold mb-4">ご予約ありがとうございます</h1>
        <p className="text-warm-500 mb-2 text-sm">予約番号: <span className="font-bold text-warm-600">{reservationId.slice(0, 8)}</span></p>
        <p className="text-warm-400 text-sm mb-8">確認メールをご登録のアドレスに送信しました。<br />当日はお気をつけてお越しください。</p>
        <Link href="/" className="inline-block bg-warm-300 hover:bg-warm-400 text-white font-bold px-8 py-3 rounded-full transition-colors text-base">ホームに戻る</Link>
      </div>
    </div>
  )
}
