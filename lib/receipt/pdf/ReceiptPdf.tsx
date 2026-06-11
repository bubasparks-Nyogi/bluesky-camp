import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './styles'
import type { ReceiptModel } from '@/lib/receipt/types'

interface Props { model: ReceiptModel; isReissue: boolean; issuedAt: string }

const yen = (n: number) => `¥${n.toLocaleString()}`

export default function ReceiptPdf({ model, isReissue, issuedAt }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>@blueSky</Text>
            <Text style={styles.title}>ご利用明細領収書</Text>
          </View>
          <View>
            {isReissue && <Text style={styles.reissue}>再発行</Text>}
            <Text style={styles.issuedAt}>発行日: {issuedAt}</Text>
          </View>
        </View>

        <Text style={styles.small}>{model.guestName} 様</Text>
        <Text style={styles.smallDim}>ご利用日: {model.checkinDate} 〜 {model.checkoutDate}（{model.nights}泊）</Text>
        <Text style={styles.smallDim}>予約番号: {model.reservationShortId}</Text>

        <View style={styles.hr} />
        <Text style={styles.sectionTitle}>ご予約料金</Text>
        {model.reservationLines.map((l, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.rowLabel}>{l.label}</Text>
            <Text style={styles.rowAmount}>{yen(l.amount)}</Text>
          </View>
        ))}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotal}>小計</Text>
          <Text style={styles.subtotal}>{yen(model.reservationSubtotal)}</Text>
        </View>
        {model.repeaterDiscount > 0 && (
          <View style={styles.row}>
            <Text style={styles.discount}>リピーター割引 −10%</Text>
            <Text style={styles.discount}>−{yen(model.repeaterDiscount)}</Text>
          </View>
        )}

        {model.saleLines.length > 0 && (
          <>
            <View style={styles.hr} />
            <Text style={styles.sectionTitle}>追加販売</Text>
            {model.saleLines.map((s, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.rowLabel}>{s.date} {s.itemName} {yen(s.unitPrice)} × {s.quantity}</Text>
                <Text style={styles.rowAmount}>{yen(s.amount)}</Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotal}>販売小計</Text>
              <Text style={styles.subtotal}>{yen(model.salesSubtotal)}</Text>
            </View>
          </>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>合計</Text>
          <Text style={styles.totalAmount}>{yen(model.grandTotal)}</Text>
        </View>

        <Text style={styles.footer}>またのご利用をお待ちしております。 @blueSky</Text>
      </Page>
    </Document>
  )
}
