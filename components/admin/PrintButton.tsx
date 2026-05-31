'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
    >
      🖨️ 印刷 / PDF保存
    </button>
  )
}
