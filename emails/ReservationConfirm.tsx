// emails/ReservationConfirm.tsx
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
  checkinDate:     string
  checkoutDate:    string
  stayTypes:       string[]
  sauna:           boolean
  pet:             boolean
  ehu:             boolean
  transferCount:   number
  transferStation: string | null
  totalAmount:     number
  siteUrl:         string
  status:          'pending' | 'confirmed'   // ← 追加
  weatherIcon?:    string
  weatherLabel?:   string
  weatherTempMax?: number
  weatherTempMin?: number
  // === site_settings から注入 ===
  siteCheckinTime?:  string
  siteCheckoutTime?: string
  siteAddress?:      string
  sitePhone?:        string
  siteGuideNote?:    string
}

export default function ReservationConfirm({
  reservationId, guestName, checkinDate, checkoutDate,
  stayTypes, sauna, pet, ehu, transferCount, transferStation,
  totalAmount, siteUrl, status,
  weatherIcon, weatherLabel, weatherTempMax, weatherTempMin,
  siteCheckinTime, siteCheckoutTime, siteAddress, sitePhone, siteGuideNote,
}: Props) {
  const shortId     = reservationId.slice(0, 8).toUpperCase()
  const detailUrl   = `${siteUrl}/reserve/lookup/${reservationId}`
  const typeLabel   = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')
  const statusLabel = status === 'confirmed' ? '確定' : '確認中（決済待ち）'
  const statusColor = status === 'confirmed' ? '#16a34a' : '#d97706'

  return (
    <Html lang="ja">
      <Preview>【@blueSky】ご予約{status === 'confirmed' ? '確認' : '受付'} - {shortId}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* ヘッダー */}
          <Section style={header}>
            <Heading style={logo}>@blueSky</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>{guestName} 様、ご予約ありがとうございます</Heading>
            <Text style={text}>ご予約内容をご確認ください。</Text>

            {/* 予約詳細 */}
            <Section style={card}>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={{ ...cardRow, color: statusColor }}>
                <strong style={{ color: '#5a3010' }}>ステータス</strong>{statusLabel}
              </Text>
              {status === 'pending' && (
                <Text style={pendingNote}>※ 決済完了後に確定メールをお送りします</Text>
              )}
              <Hr style={divider} />
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
              {sauna    && <Text style={cardRow}><strong>サウナ</strong>利用</Text>}
              {pet      && <Text style={cardRow}><strong>ペット</strong>同伴</Text>}
              {ehu      && <Text style={cardRow}><strong>EHU</strong>使用（使用量料金制）</Text>}
              {transferCount > 0 && (
                <Text style={cardRow}>
                  <strong>送迎</strong>{transferCount}名（{transferStation}）
                </Text>
              )}
              <Hr style={divider} />
              <Text style={totalRow}>
                <strong>合計金額</strong>¥{totalAmount.toLocaleString()}
              </Text>
            </Section>

            <Button href={detailUrl} style={button}>
              予約を確認する・キャンセルはこちら
            </Button>

            {process.env.NEXT_PUBLIC_LIFF_ID && (
              <Section style={{ marginTop: 8, marginBottom: 24, textAlign: 'center' as const }}>
                <a
                  href={`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?reservationId=${reservationId}`}
                  style={lineButton}
                >
                  📱 LINEで連絡する
                </a>
                <Text style={lineNote}>当日の追加注文や質問はLINEでお気軽にどうぞ</Text>
              </Section>
            )}

            {/* 天気予報 */}
            {weatherLabel && (
              <Section style={weatherBox}>
                <Text style={policyTitle}>チェックイン日の天気予報</Text>
                <Text style={{ ...policyText, fontSize: '14px' }}>
                  {weatherIcon} {weatherLabel}　最高 {weatherTempMax}℃ / 最低 {weatherTempMin}℃
                </Text>
              </Section>
            )}

            {/* ご利用案内（site_settings） */}
            {(siteCheckinTime || siteCheckoutTime || siteAddress || sitePhone || siteGuideNote) && (
              <Section style={infoBox}>
                <Text style={infoTitle}>ご利用案内</Text>
                {siteCheckinTime && (
                  <Text style={infoText}><strong>チェックイン時間</strong>　{siteCheckinTime}</Text>
                )}
                {siteCheckoutTime && (
                  <Text style={infoText}><strong>チェックアウト時間</strong>　{siteCheckoutTime}</Text>
                )}
                {siteAddress && (
                  <Text style={infoText}><strong>所在地</strong>　{siteAddress}</Text>
                )}
                {sitePhone && (
                  <Text style={infoText}><strong>緊急連絡先</strong>　<a href={`tel:${sitePhone.replace(/-/g, '')}`} style={{ color: '#5a3010' }}>{sitePhone}</a></Text>
                )}
                {siteGuideNote && (
                  <Text style={{ ...infoText, whiteSpace: 'pre-wrap' as const, marginTop: 8 }}>{siteGuideNote}</Text>
                )}
              </Section>
            )}

            {/* キャンセルポリシー */}
            <Section style={policyBox}>
              <Text style={policyTitle}>キャンセルポリシー</Text>
              <Text style={policyText}>7日前まで：無料</Text>
              <Text style={policyText}>3〜6日前：合計金額の50%</Text>
              <Text style={policyText}>前日・当日：合計金額の100%</Text>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              このメールはご予約完了時に自動送信されています。<br />
              ご不明な点は予約番号をご記載の上お問い合わせください。
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---- styles ---- */
const body:       React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:  React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:     React.CSSProperties = { backgroundColor: '#5a3010', padding: '24px', textAlign: 'center' }
const logo:       React.CSSProperties = { color: '#fdf8f0', fontSize: '24px', margin: 0 }
const content:    React.CSSProperties = { padding: '32px 24px' }
const h2:         React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '8px' }
const text:       React.CSSProperties = { color: '#7c4a1e', fontSize: '14px', marginBottom: '24px' }
const card:       React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '24px' }
const cardRow:    React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0', display: 'flex', gap: '16px' }
const totalRow:   React.CSSProperties = { color: '#5a3010', fontSize: '16px', fontWeight: 'bold', margin: '4px 0' }
const divider:    React.CSSProperties = { borderColor: '#f0c080', margin: '12px 0' }
const pendingNote:React.CSSProperties = { color: '#d97706', fontSize: '11px', margin: '2px 0 8px' }
const button:     React.CSSProperties = { backgroundColor: '#d4845a', color: '#ffffff', padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const lineButton: React.CSSProperties = { display: 'inline-block', padding: '12px 24px', backgroundColor: '#06C755', color: '#ffffff', textDecoration: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }
const lineNote:   React.CSSProperties = { fontSize: '11px', color: '#888', marginTop: '6px', textAlign: 'center' as const }
const policyBox:  React.CSSProperties = { backgroundColor: '#f9eed8', borderLeft: '3px solid #d4845a', padding: '12px 16px', marginTop: '24px' }
const infoBox:    React.CSSProperties = { backgroundColor: '#fff8eb', borderLeft: '3px solid #d4845a', padding: '12px 16px', marginTop: '24px' }
const infoTitle:  React.CSSProperties = { color: '#5a3010', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }
const infoText:   React.CSSProperties = { color: '#5a3010', fontSize: '13px', margin: '2px 0' }
const weatherBox: React.CSSProperties = { backgroundColor: '#e0f2fe', borderLeft: '3px solid #38bdf8', padding: '12px 16px', marginTop: '24px' }
const policyTitle:React.CSSProperties = { color: '#5a3010', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }
const policyText: React.CSSProperties = { color: '#7c4a1e', fontSize: '12px', margin: '2px 0' }
const footer:     React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText: React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
