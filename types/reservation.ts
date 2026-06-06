// types/reservation.ts

export type StayType = 'tent' | 'trailer_a' | 'trailer_b' | 'campervan'
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled'

export interface RentalItem {
  id:           string
  name:         string
  pricePerDay:  number
  available:    boolean
  imageUrl?:    string
}

export interface PricingItem {
  itemKey: string
  label:   string
  amount:  number
  active:  boolean
}

/** 予約フォームの入力状態（/reserve ページ内で管理） */
export interface ReservationFormData {
  checkinDate:     string      // YYYY-MM-DD
  checkoutDate:    string      // YYYY-MM-DD
  stayTypes:       StayType[]  // 複数選択可
  ehu:             boolean     // キャンピングカー選択時のみ有効
  sauna:           boolean
  pet:             boolean
  transferCount:   number      // 0 = なし
  transferStation: string
  rentalItems:     SelectedRentalItem[]
  guestName:       string
  guestEmail:      string
  guestPhone:      string
}

export interface SelectedRentalItem {
  id:    string
  name:  string
  price: number
  qty:   number
}

/** Supabase の reservations テーブル行 */
export interface ReservationRow {
  id:                string
  checkin_date:      string
  checkout_date:     string
  status:            ReservationStatus
  stay_type:         StayType         // 後方互換（先頭タイプ）
  stay_types:        StayType[]       // 複数タイプ
  ehu:               boolean
  sauna:             boolean
  pet:               boolean
  transfer_count:    number
  transfer_station:  string | null
  rental_items:      SelectedRentalItem[]
  guest_name:        string
  guest_email:       string
  guest_phone:       string
  total_amount:      number
  stripe_payment_id: string | null
  line_user_id:      string | null
  user_id:           string | null
  payment_method:    'onsite' | 'prepaid' | null
  paid_at:           string | null
  agreed_to_terms_at: string | null
  created_at:        string
}

export const STEP_LABELS = [
  '日程選択',
  '宿泊タイプ',
  'サウナ',
  'ペット',
  '送迎',
  '道具レンタル',
  'お客様情報',
  '利用規約',
  '金額確認',
  '決済',
] as const

export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
