'use client'
import { QRCodeSVG } from 'qrcode.react'

interface Props {
  reservationId: string
  baseUrl: string
}

export default function CheckinQR({ reservationId, baseUrl }: Props) {
  const url = `${baseUrl}/admin/checkin/${reservationId}`
  return (
    <div className="bg-warm-100 border border-warm-200 rounded-2xl p-5 text-center space-y-3 mt-6">
      <p className="font-bold text-warm-700">📱 チェックイン QR コード</p>
      <p className="text-warm-500 text-xs">当日この QR をオーナーに提示してください</p>
      <div className="inline-block bg-white p-3 rounded-lg">
        <QRCodeSVG value={url} size={200} level="M" />
      </div>
    </div>
  )
}
