import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './styles'
import type { CancellationFeeModel } from '@/lib/receipt/types'

interface Props { model: CancellationFeeModel; isReissue: boolean; issuedAt: string }
const yen = (n: number) => `¥${n.toLocaleString()}`

export default function CancellationFeePdf({ model, isReissue, issuedAt }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>@blueSky</Text>
            <Text style={styles.title}>キャンセル料明細書</Text>
          </View>
          <View>
            {isReissue && <Text style={styles.reissue}>再発行</Text>}
            <Text style={styles.issuedAt}>発行日: {issuedAt}</Text>
          </View>
        </View>

        <Text style={styles.small}>{model.guestName} 様</Text>
        <Text style={styles.smallDim}>予約番号: {model.reservationShortId}</Text>
        <Text style={styles.smallDim}>ご予約日程: {model.checkinDate} 〜 {model.checkoutDate}</Text>
        <Text style={styles.smallDim}>キャンセル日: {model.cancelledAt}</Text>

        <View style={styles.hr} />
        <Text style={styles.sectionTitle}>キャンセル料</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>合計金額</Text>
          <Text style={styles.rowAmount}>{yen(model.totalAmount)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>適用率</Text>
          <Text style={styles.rowAmount}>{model.feeLabel}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>ご請求額</Text>
          <Text style={styles.feeAmount}>{yen(model.feeAmount)}</Text>
        </View>

        <Text style={styles.footer}>お振込先・お問い合わせは下記までお願いします。 @blueSky</Text>
      </Page>
    </Document>
  )
}
