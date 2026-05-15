// emails/CancellationNotify.tsx
import {
  Html, Body, Container, Heading, Text, Button, Hr, Section, Preview,
} from '@react-email/components'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props {
  reservationId: string
  guestName:     string
  guestEmail:    string
  guestPhone:    string
  checkinDate:   string
  checkoutDate:  string
  stayTypes:     string[]
  totalAmount:   number
  feeRate:       number
  feeAmount:     number
  feeLabel:      string
  cancelledAt:   string   // ISO 文字列
  adminUrl:      string
}

export default function CancellationNotify({
  reservationId, guestName, guestEmail, guestPhone,
  checkinDate, checkoutDate, stayTypes,
  totalAmount, feeRate, feeAmount, feeLabel,
  cancelledAt, adminUrl,
}: Props) {
  const shortId   = reservationId.slice(0, 8).toUpperCase()
  const typeLabel = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')
  const cancelledDate = new Date(cancelledAt).toLocaleString('ja-JP')

  return (
    <Html lang="ja">
      <Preview>【キャンセル】{shortId} - {guestName} 様</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>@blueSky 管理</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>キャンセルが発生しました</Heading>

            <Section style={card}>
              <Text style={sectionLabel}>キャンセルされた予約</Text>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
              <Text style={cardRow}><strong>予約金額</strong>¥{totalAmount.toLocaleString()}</Text>
              <Text style={cardRow}><strong>キャンセル日時</strong>{cancelledDate}</Text>
            </Section>

            <Section style={feeCard}>
              <Text style={sectionLabel}>キャンセル料</Text>
              <Hr style={divider} />
              {feeRate === 0 ? (
                <Text style={feeAmountFree}>無料（0円）</Text>
              ) : (
                <Text style={feeAmountCharged}>¥{feeAmount.toLocaleString()}（{feeLabel}）</Text>
              )}
            </Section>

            <Section style={card}>
              <Text style={sectionLabel}>お客様情報</Text>
              <Text style={cardRow}><strong>お名前</strong>{guestName}</Text>
              <Text style={cardRow}><strong>メール</strong>{guestEmail}</Text>
              <Text style={cardRow}><strong>電話</strong>{guestPhone}</Text>
            </Section>

            <Button href={adminUrl} style={button}>
              管理画面で確認する
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>@blueSky 予約管理システム</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---- styles ---- */
const body:            React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:       React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:          React.CSSProperties = { backgroundColor: '#3d2010', padding: '24px', textAlign: 'center' }
const logo:            React.CSSProperties = { color: '#fdf8f0', fontSize: '20px', margin: 0 }
const content:         React.CSSProperties = { padding: '32px 24px' }
const h2:              React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '16px' }
const card:            React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const feeCard:         React.CSSProperties = { backgroundColor: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const sectionLabel:    React.CSSProperties = { color: '#a05a30', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const cardRow:         React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0' }
const divider:         React.CSSProperties = { borderColor: '#fca5a5', margin: '8px 0' }
const feeAmountFree:   React.CSSProperties = { color: '#16a34a', fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }
const feeAmountCharged:React.CSSProperties = { color: '#dc2626', fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }
const button:          React.CSSProperties = { backgroundColor: '#5a3010', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }
const footer:          React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText:      React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
