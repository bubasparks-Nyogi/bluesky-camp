import { Html, Body, Container, Heading, Text, Hr, Preview, Row, Column } from '@react-email/components'
import type { CancellationFeeModel } from '@/lib/receipt/types'

const wrap  = { backgroundColor: '#fdf9f3', fontFamily: 'sans-serif', padding: '24px' }
const card  = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '600px', margin: '0 auto' }
const muted = { color: '#8a7460', fontSize: '13px' }
const label = { fontSize: '14px', color: '#5a4a3a' }
const amount = { fontSize: '14px', color: '#5a4a3a', textAlign: 'right' as const }
const total = { fontSize: '18px', fontWeight: 'bold' as const, color: '#dc2626' }

export default function CancellationFeeReceipt({ model }: { model: CancellationFeeModel }) {
  const yen = (n: number) => `¥${n.toLocaleString()}`
  return (
    <Html>
      <Preview>{`【@blueSky】キャンセル料明細書 ${model.reservationShortId}`}</Preview>
      <Body style={wrap}>
        <Container style={card}>
          <Heading style={{ color: '#a16745', fontSize: '20px' }}>@blueSky キャンセル料のご案内</Heading>
          <Text style={muted}>{model.guestName} 様</Text>
          <Text style={muted}>予約番号: {model.reservationShortId}</Text>
          <Text style={muted}>ご予約日程: {model.checkinDate} 〜 {model.checkoutDate}</Text>
          <Text style={muted}>キャンセル日: {model.cancelledAt}</Text>

          <Hr />
          <Heading as="h3" style={{ fontSize: '15px', color: '#5a4a3a' }}>キャンセル料</Heading>
          <Row><Column style={label}>合計金額</Column><Column style={amount}>{yen(model.totalAmount)}</Column></Row>
          <Row><Column style={label}>適用率</Column><Column style={amount}>{model.feeLabel}</Column></Row>
          <Hr />
          <Row><Column style={total}>ご請求額</Column><Column style={{ ...total, textAlign: 'right' as const }}>{yen(model.feeAmount)}</Column></Row>

          <Hr />
          <Text style={muted}>お振込先・お問い合わせは下記までお願いします。</Text>
          <Text style={muted}>@blueSky</Text>
        </Container>
      </Body>
    </Html>
  )
}
