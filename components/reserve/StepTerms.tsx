'use client'
import { useState } from 'react'

interface Props {
  onNext: () => void
  onBack: () => void
}

export default function StepTerms({ onNext, onBack }: Props) {
  const [checked, setChecked] = useState({ cancel: false, damage: false, disclaimer: false })
  const allChecked = checked.cancel && checked.damage && checked.disclaimer

  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-2">利用規約への同意</h3>
      <p className="text-warm-400 text-sm mb-6">以下をお読みの上、チェックを入れてください</p>

      {/* キャンセルポリシー */}
      <div className="bg-warm-50 rounded-xl p-5 mb-4 text-sm">
        <h4 className="font-bold text-warm-600 mb-2">キャンセルポリシー</h4>
        <div className="overflow-x-auto mb-1">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-warm-100">
                <th className="border border-warm-200 px-3 py-1.5 text-left text-warm-600">キャンセル日</th>
                <th className="border border-warm-200 px-3 py-1.5 text-left text-warm-600">キャンセル料</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border border-warm-200 px-3 py-1.5">7日前まで</td><td className="border border-warm-200 px-3 py-1.5">無料</td></tr>
              <tr className="bg-warm-50"><td className="border border-warm-200 px-3 py-1.5">3〜6日前</td><td className="border border-warm-200 px-3 py-1.5">50%</td></tr>
              <tr><td className="border border-warm-200 px-3 py-1.5">前日・当日</td><td className="border border-warm-200 px-3 py-1.5">100%</td></tr>
            </tbody>
          </table>
        </div>
        <label className="flex items-center gap-3 cursor-pointer mt-3">
          <input type="checkbox" checked={checked.cancel}
            onChange={e => setChecked(c => ({ ...c, cancel: e.target.checked }))}
            className="w-5 h-5 accent-warm-300 flex-shrink-0" />
          <span className="text-warm-600 text-sm font-medium">キャンセルポリシーに同意します</span>
        </label>
      </div>

      {/* 損害補填 */}
      <div className="bg-warm-50 rounded-xl p-5 mb-4 text-sm">
        <h4 className="font-bold text-warm-600 mb-2">損害補填規定</h4>
        <p className="text-warm-500 text-xs mb-3">利用者またはペットが施設・設備に損害を与えた場合（大規模清掃・補修・器物破損等）、実費を請求します。</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={checked.damage}
            onChange={e => setChecked(c => ({ ...c, damage: e.target.checked }))}
            className="w-5 h-5 accent-warm-300 flex-shrink-0" />
          <span className="text-warm-600 text-sm font-medium">損害補填規定に同意します</span>
        </label>
      </div>

      {/* 免責事項 */}
      <div className="bg-warm-50 rounded-xl p-5 mb-6 text-sm">
        <h4 className="font-bold text-warm-600 mb-2">免責事項</h4>
        <p className="text-warm-500 text-xs mb-3">宿泊中・使用中の持ち込み道具・レンタル道具・ペットの破損・紛失・死亡について、施設は一切責任を負いません。</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={checked.disclaimer}
            onChange={e => setChecked(c => ({ ...c, disclaimer: e.target.checked }))}
            className="w-5 h-5 accent-warm-300 flex-shrink-0" />
          <span className="text-warm-600 text-sm font-medium">免責事項に同意します</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
                className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">
          ← 戻る
        </button>
        <button onClick={onNext} disabled={!allChecked}
                className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-40
                           text-white font-bold py-3 rounded-lg transition-colors text-base">
          同意して次へ →
        </button>
      </div>
    </div>
  )
}
