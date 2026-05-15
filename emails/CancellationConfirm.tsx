// emails/CancellationConfirm.tsx
import {
  Html, Body, Container, Heading, Text, Button, Section, Preview,
} from '@react-email/components'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props {
  reservationId: string
  guestName:     string
  checkinDate:   string
  checkoutDate:  string
  stayTypes:     string[]
  feeRate:       number    // 0 | 50 | 100
  feeAmount:     number
  feeLabel:      string    // '無料' | '合計金額の50%' | '合計金額の100%'
  siteUrl:       string
}

export default function CancellationConfirm({
  reservationId, guestName, checkinDate, checkoutDate,
  stayTypes, feeRate, feeAmount, feeLabel, siteUrl,
}: Props) {
  const shortId   = reservationId.slice(0, 8).toUpperCase()
  const typeLabel = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')

  return (
    <Html lang="ja">
      <Preview>【@blueSky】キャンセル受付 - {shortId}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>@blueSky</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>{guestName} 様、キャンセルを受け付けました</Heading>

            <Section style={card}>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
            </Section>

            {/* キャンセル料 */}
            <Section style={feeBox}>
              <Text style={feeTitle}>キャンセル料</Text>
              {feeRate === 0 ? (
                <Text style={feeAmountFree}>無料</Text>
              ) : (
                <>
                  <Text style={feeAmountCharged}>¥{feeAmount.toLocaleString()}</Text>
                  <Text style={feeNote}>（{feeLabel}）</Text>
                </>
              )}
              <Text style={feeDisclaimer}>※ お支払いについては別途ご連絡します</Text>
            </Section>

            <Button href={`${siteUrl}/reserve`} style={button}>
              再予約はこちら
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              このメールはキャンセル確定時に自動送信されています。
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---- styles ---- */
const body:            React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:       React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:          React.CSSProperties = { backgroundColor: '#5a3010', padding: '24px', textAlign: 'center' }
const logo:            React.CSSProperties = { color: '#fdf8f0', fontSize: '24px', margin: 0 }
const content:         React.CSSProperties = { padding: '32px 24px' }
const h2:              React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '16px' }
const card:            React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const cardRow:         React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0' }
const feeBox:          React.CSSProperties = { backgroundColor: '#fff8f0', border: '1px solid #f0c080', borderRadius: '8px', padding: '16px', marginBottom: '24px', textAlign: 'center' }
const feeTitle:        React.CSSProperties = { color: '#7c4a1e', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }
const feeAmountFree:   React.CSSProperties = { color: '#16a34a', fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }
const feeAmountCharged:React.CSSProperties = { color: '#dc2626', fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }
const feeNote:         React.CSSProperties = { color: '#7c4a1e', fontSize: '12px', margin: '2px 0' }
const feeDisclaimer:   React.CSSProperties = { color: '#a05a30', fontSize: '11px', marginTop: '12px' }
const button:          React.CSSProperties = { backgroundColor: '#d4845a', color: '#ffffff', padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }
const footer:          React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText:      React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
