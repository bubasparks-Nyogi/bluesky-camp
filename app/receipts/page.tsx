import ReceiptLookupForm from './ReceiptLookupForm'

export const metadata = {
  title: '領収書ダウンロード | @blueSky',
  robots: { index: false, follow: false },
}

interface Props { searchParams: { id?: string } }

export default function ReceiptsPage({ searchParams }: Props) {
  return (
    <main className="min-h-screen bg-warm-50 py-16 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="font-serif text-3xl text-warm-700 mb-2">領収書ダウンロード</h1>
        <p className="text-warm-400 text-sm mb-8">予約番号とご登録メールアドレスを入力してください。</p>
        <ReceiptLookupForm defaultReservationId={searchParams.id ?? ''} />
      </div>
    </main>
  )
}
