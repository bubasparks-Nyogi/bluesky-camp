import Link from 'next/link'

export const metadata = {
  title: '利用規約 | @blueSky',
}

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-600 text-white py-4 px-6 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">@blueSky 利用規約</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-10 text-warm-700">

        <section>
          <h2 className="font-serif text-xl font-bold text-warm-600 mb-3 border-b border-warm-200 pb-2">
            第1条　持ち込み規定
          </h2>
          <p className="text-sm leading-relaxed mb-2">以下の品目は持ち込み可能です。</p>
          <ul className="list-disc list-inside text-sm space-y-1 mb-3 text-warm-600">
            <li>食品・飲料（アルコール含む）</li>
            <li>キャンプ道具一式（テント・椅子・テーブル等）</li>
            <li>ペット用品</li>
          </ul>
          <p className="text-sm leading-relaxed">危険物（火薬・引火性液体等）、違法薬物の持ち込みは固く禁じます。発覚した場合は即時退場いただき、法的手続きを取る場合があります。</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-warm-600 mb-3 border-b border-warm-200 pb-2">
            第2条　ペット規定
          </h2>
          <p className="text-sm leading-relaxed mb-2">小型動物（全長80㎝程度まで）の同伴を歓迎します。犬種・頭数については事前にご相談ください。</p>
          <p className="text-sm leading-relaxed">ペットの行動（他のゲストへの迷惑行為・施設や備品への傷・汚染等）により生じた一切の損害は、利用者の負担とします。ペットのリード着用を推奨します。</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-warm-600 mb-3 border-b border-warm-200 pb-2">
            第3条　損害補填規定
          </h2>
          <p className="text-sm leading-relaxed">利用者またはペットが施設・設備・備品に損害（大規模清掃・補修・器物破損・草木の損傷等）を与えた場合、当施設は実費を請求します。</p>
          <p className="text-sm leading-relaxed mt-2">損害額が著しい場合、チェックアウト後に別途請求書を送付することがあります。</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-warm-600 mb-3 border-b border-warm-200 pb-2">
            第4条　免責事項
          </h2>
          <p className="text-sm leading-relaxed">宿泊中・使用中に発生した以下の事象について、当施設は一切の責任を負いません。</p>
          <ul className="list-disc list-inside text-sm space-y-1 mt-2 text-warm-600">
            <li>利用者の持ち込み道具・レンタル道具の破損・紛失</li>
            <li>ペットの怪我・死亡・紛失</li>
            <li>天候・自然災害に起因する損害</li>
            <li>利用者同士または利用者と第三者間のトラブル</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-bold text-warm-600 mb-3 border-b border-warm-200 pb-2">
            第5条　キャンセルポリシー
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-warm-100">
                  <th className="border border-warm-200 px-4 py-2 text-left text-warm-600">キャンセル日</th>
                  <th className="border border-warm-200 px-4 py-2 text-left text-warm-600">キャンセル料</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-warm-200 px-4 py-2">7日前まで</td>
                  <td className="border border-warm-200 px-4 py-2">無料</td>
                </tr>
                <tr className="bg-warm-50">
                  <td className="border border-warm-200 px-4 py-2">3〜6日前</td>
                  <td className="border border-warm-200 px-4 py-2">宿泊料金の50%</td>
                </tr>
                <tr>
                  <td className="border border-warm-200 px-4 py-2">前日・当日</td>
                  <td className="border border-warm-200 px-4 py-2">宿泊料金の100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-warm-400 mt-3">※ 天候・自然災害等の不可抗力によるキャンセルについては個別にご相談ください。</p>
        </section>

        <div className="pt-6 border-t border-warm-200 text-center">
          <Link href="/reserve" className="inline-block bg-warm-300 hover:bg-warm-400 text-white font-bold px-8 py-3 rounded-full text-sm transition-colors">
            ご予約はこちら →
          </Link>
        </div>
      </main>
    </div>
  )
}
