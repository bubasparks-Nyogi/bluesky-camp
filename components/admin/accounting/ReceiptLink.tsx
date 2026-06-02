'use client'
export default function ReceiptLink({ path }: { path: string }) {
  const open = async () => {
    const res = await fetch(`/api/admin/accounting/receipt-url?path=${encodeURIComponent(path)}`)
    const json = await res.json()
    if (json.url) window.open(json.url, '_blank', 'noopener')
  }
  return <button onClick={open} className="text-warm-500 text-xs underline hover:text-warm-700">🧾 レシート</button>
}
