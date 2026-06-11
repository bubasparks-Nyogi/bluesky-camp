import { Font, StyleSheet } from '@react-pdf/renderer'

Font.register({
  family: 'Noto Sans JP',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vY0rw-oME.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/notosansjp/v52/-F6pfjtqLzI2JPCgQBnw7HFQoggM-FNthvIU.ttf', fontWeight: 'bold' },
  ],
})

export const colors = {
  warm700: '#8a6e54',
  warm500: '#a16745',
  warm300: '#c9a87e',
  warm100: '#f0e3d2',
  red500:  '#dc2626',
  green600:'#16a34a',
  textDim: '#888888',
}

export const styles = StyleSheet.create({
  page:        { padding: 50, fontFamily: 'Noto Sans JP', fontSize: 10, color: colors.warm700 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  brand:       { fontSize: 18, color: colors.warm500, fontWeight: 'bold' },
  title:       { fontSize: 14, color: colors.warm700, marginTop: 4 },
  reissue:     { fontSize: 12, color: colors.red500, fontWeight: 'bold' },
  issuedAt:    { fontSize: 9, color: colors.textDim, marginTop: 2 },
  hr:          { borderBottom: 1, borderColor: colors.warm100, marginVertical: 10 },
  small:       { fontSize: 10, color: colors.warm700 },
  smallDim:    { fontSize: 9, color: colors.textDim, marginTop: 2 },
  sectionTitle:{ fontSize: 11, color: colors.warm500, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel:    { fontSize: 10, color: colors.warm700, flex: 1 },
  rowAmount:   { fontSize: 10, color: colors.warm700, textAlign: 'right' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTop: 0.5, borderColor: colors.warm100, marginTop: 4 },
  subtotal:    { fontSize: 10, color: colors.warm700, fontWeight: 'bold' },
  discount:    { fontSize: 10, color: colors.green600 },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTop: 1, borderBottom: 1, borderColor: colors.warm300, marginTop: 12 },
  totalLabel:  { fontSize: 14, color: colors.warm500, fontWeight: 'bold' },
  totalAmount: { fontSize: 14, color: colors.warm500, fontWeight: 'bold' },
  feeAmount:   { fontSize: 14, color: colors.red500, fontWeight: 'bold' },
  footer:      { fontSize: 9, color: colors.textDim, marginTop: 24, textAlign: 'center' },
})
