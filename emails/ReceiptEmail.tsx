import { Html, Body, Container, Heading, Text, Hr, Section, Preview, Row, Column } from '@react-email/components'
import type { ReceiptModel } from '@/lib/receipt/types'

const wrap   = { backgroundColor: '#fdf9f3', fontFamily: 'sans-serif', padding: '24px' }
const card   = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '600px', margin: '0 auto' }
const muted  = { color: '#8a7460', fontSize: '13px' }
const label  = { fontSize: '14px', color: '#5a4a3a' }
const amount = { fontSize: '14px', color: '#5a4a3a', textAlign: 'right' as const }
const total  = { fontSize: '18px', fontWeight: 'bold' as const, color: '#a16745' }

export default function ReceiptEmail({ model }: { model: ReceiptModel }) {
  const yen = (n: number) => `¥${n.toLocaleString()}`
  return (
    <Html>
      <Preview>{`【@blueSky】ご利用明細領収書 ${model.reservationShortId}`}</Preview>
      <Body style={wrap}>
        <Container style={card}>
          <Heading style={{ color: '#a16745', fontSize: '20px', marginBottom: 0 }}>@blueSky ご利用ありがとうございました</Heading>
          <Text style={muted}>{model.guestName} 様</Text>
          <Text style={muted}>ご利用日: {model.checkinDate} 〜 {model.checkoutDate}（{model.nights}泊）</Text>
          <Text style={muted}>予約番号: {model.reservationShortId}</Text>

          <Hr />
          <Heading as="h3" style={{ fontSize: '15px', color: '#5a4a3a' }}>ご予約料金</Heading>
          <Section>
            {model.reservationLines.map((l, i) => (
              <Row key={i}><Column style={label}>{l.label}</Column><Column style={amount}>{yen(l.amount)}</Column></Row>
            ))}
            <Row><Column style={{ ...label, fontWeight: 'bold' }}>小計</Column><Column style={{ ...amount, fontWeight: 'bold' }}>{yen(model.reservationSubtotal)}</Column></Row>
            {model.repeaterDiscount > 0 && (
              <Row><Column style={{ ...label, color: '#16a34a' }}>リピーター割引 −10%</Column><Column style={{ ...amount, color: '#16a34a' }}>−{yen(model.repeaterDiscount)}</Column></Row>
            )}
          </Section>

          {model.saleLines.length > 0 && (
            <>
              <Hr />
              <Heading as="h3" style={{ fontSize: '15px', color: '#5a4a3a' }}>追加販売</Heading>
              <Section>
                {model.saleLines.map(s => (
                  <Row key={`${s.date}-${s.itemName}-${s.unitPrice}`}>
                    <Column style={label}>{s.date} {s.itemName} {yen(s.unitPrice)} × {s.quantity}</Column>
                    <Column style={amount}>{yen(s.amount)}</Column>
                  </Row>
                ))}
                <Row><Column style={{ ...label, fontWeight: 'bold' }}>販売小計</Column><Column style={{ ...amount, fontWeight: 'bold' }}>{yen(model.salesSubtotal)}</Column></Row>
              </Section>
            </>
          )}

          <Hr />
          <Row><Column style={total}>合計</Column><Column style={{ ...total, textAlign: 'right' as const }}>{yen(model.grandTotal)}</Column></Row>

          <Hr />
          <Text style={muted}>またのご利用をお待ちしております。</Text>
          <Text style={muted}>@blueSky</Text>
        </Container>
      </Body>
    </Html>
  )
}
