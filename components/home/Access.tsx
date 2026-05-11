export default function Access() {
  return (
    <section id="access" className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl md:text-3xl text-warm-600 text-center mb-2">アクセス</h2>
        <p className="text-center text-warm-400 mb-12 text-sm tracking-widest">ACCESS</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="rounded-2xl overflow-hidden shadow-md w-full aspect-video">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3267.0!2d135.93!3d35.36!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z44K544Kk44OG!5e0!3m2!1sja!2sjp!4v1620000000000!5m2!1sja!2sjp"
              width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title="@blueSky アクセスマップ"
            />
          </div>
          <div className="space-y-4 text-sm text-warm-600">
            <div><p className="font-bold mb-1">住所</p><p>〒520-1501<br />滋賀県高島市安曇川町川島1478-5</p></div>
            <div><p className="font-bold mb-1">電車</p><p>JR湖西線「近江高島駅」より車で約10分</p><p className="text-warm-400 text-xs mt-1">※送迎サービスをご利用の場合は予約時にお申し込みください</p></div>
            <div><p className="font-bold mb-1">お車</p><p>名神高速道路「大津IC」より約50分</p></div>
            <div><p className="font-bold mb-1">チェックイン / アウト</p><p>チェックイン 15:00〜 / チェックアウト 〜11:00</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}
