// emails/ReservationNotify.tsx
import {
  Html, Body, Container, Heading, Text, Button, Hr, Section, Preview,
} from '@react-email/components'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props {
  reservationId:   string
  guestName:       string
  guestEmail:      string
  guestPhone:      string
  checkinDate:     string
  checkoutDate:    string
  stayTypes:       string[]
  sauna:           boolean
  pet:             boolean
  ehu:             boolean
  transferCount:   number
  transferStation: string | null
  totalAmount:     number
  adminUrl:        string
}

export default function ReservationNotify({
  reservationId, guestName, guestEmail, guestPhone,
  checkinDate, checkoutDate, stayTypes,
  sauna, pet, ehu, transferCount, transferStation,
  totalAmount, adminUrl,
}: Props) {
  const shortId   = reservationId.slice(0, 8).toUpperCase()
  const typeLabel = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')

  return (
    <Html lang="ja">
      <Preview>【新規予約】{shortId} - {guestName} 様</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>@blueSky 管理</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>新規予約が入りました</Heading>

            <Section style={card}>
              <Text style={sectionLabel}>予約情報</Text>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
              {sauna         && <Text style={cardRow}><strong>サウナ</strong>利用</Text>}
              {pet           && <Text style={cardRow}><strong>ペット</strong>同伴</Text>}
              {ehu           && <Text style={cardRow}><strong>EHU</strong>使用</Text>}
              {transferCount > 0 && (
                <Text style={cardRow}>
                  <strong>送迎</strong>{transferCount}名（{transferStation}）
                </Text>
              )}
              <Hr style={divider} />
              <Text style={totalRow}><strong>合計金額</strong>¥{totalAmount.toLocaleString()}</Text>
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
const body:        React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:   React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:      React.CSSProperties = { backgroundColor: '#3d2010', padding: '24px', textAlign: 'center' }
const logo:        React.CSSProperties = { color: '#fdf8f0', fontSize: '20px', margin: 0 }
const content:     React.CSSProperties = { padding: '32px 24px' }
const h2:          React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '16px' }
const card:        React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const sectionLabel:React.CSSProperties = { color: '#a05a30', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const cardRow:     React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0' }
const totalRow:    React.CSSProperties = { color: '#5a3010', fontSize: '16px', fontWeight: 'bold', margin: '4px 0' }
const divider:     React.CSSProperties = { borderColor: '#f0c080', margin: '12px 0' }
const button:      React.CSSProperties = { backgroundColor: '#5a3010', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }
const footer:      React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText:  React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
