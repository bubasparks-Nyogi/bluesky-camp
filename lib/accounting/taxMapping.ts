// 青色申告書フォーマットに対応する科目マッピング

export interface PlCategory {
  key: string
  label: string
  accountCodes: readonly string[]
}

export const PL_REVENUE: PlCategory = {
  key: 'revenue',
  label: '売上（収入）金額',
  accountCodes: ['401', '402'],
}

export const PL_PURCHASES: PlCategory = {
  key: 'purchases',
  label: '仕入金額',
  accountCodes: ['501'],
}

export const PL_TAX_CATEGORIES: readonly PlCategory[] = [
  { key: 'salary',        label: '給料賃金',     accountCodes: ['522'] },
  { key: 'outsourcing',   label: '外注工賃',     accountCodes: ['523'] },
  { key: 'depreciation',  label: '減価償却費',   accountCodes: ['520'] },
  { key: 'rent',          label: '地代家賃',     accountCodes: ['525'] },
  { key: 'interest',      label: '利子割引料',   accountCodes: ['524'] },
  { key: 'tax',           label: '租税公課',     accountCodes: ['511'] },
  { key: 'utility',       label: '水道光熱費',   accountCodes: ['512'] },
  { key: 'travel',        label: '旅費交通費',   accountCodes: ['513'] },
  { key: 'communication', label: '通信費',       accountCodes: ['514'] },
  { key: 'advertising',   label: '広告宣伝費',   accountCodes: ['515'] },
  { key: 'entertainment', label: '接待交際費',   accountCodes: ['516'] },
  { key: 'insurance',     label: '損害保険料',   accountCodes: ['517'] },
  { key: 'repair',        label: '修繕費',       accountCodes: ['518'] },
  { key: 'supplies',      label: '消耗品費',     accountCodes: ['519'] },
  { key: 'welfare',       label: '福利厚生費',   accountCodes: ['521'] },
  { key: 'fee',           label: '支払手数料',   accountCodes: ['526'] },
  { key: 'other_expense', label: '雑費',         accountCodes: ['530'] },
]

export interface BsCategory {
  key: string
  label: string
  section: 'asset' | 'liability' | 'equity'
  accountCodes?: readonly string[]
  codePrefix?: string
  computed?: 'netIncome'
}

export const BS_CATEGORIES: readonly BsCategory[] = [
  { key: 'cashEquivalents', label: '現金・預金',   section: 'asset',     accountCodes: ['101', '102'] },
  { key: 'receivables',     label: '売掛金',       section: 'asset',     accountCodes: ['103'] },
  { key: 'prepayments',     label: '前払金',       section: 'asset',     accountCodes: ['104'] },
  { key: 'inventory',       label: '棚卸資産',     section: 'asset',     accountCodes: ['105'] },
  { key: 'fixedAssets',     label: '固定資産',     section: 'asset',     codePrefix: '15' },
  { key: 'payables',        label: '買掛金',       section: 'liability', accountCodes: ['201'] },
  { key: 'unpaid',          label: '未払金',       section: 'liability', accountCodes: ['202'] },
  { key: 'advanceReceived', label: '前受金',       section: 'liability', accountCodes: ['203'] },
  { key: 'deposits',        label: '預り金',       section: 'liability', accountCodes: ['204'] },
  { key: 'loans',           label: '借入金',       section: 'liability', accountCodes: ['211'] },
  { key: 'capital',         label: '元入金',       section: 'equity',    accountCodes: ['301'] },
  { key: 'ownerDrawing',    label: '事業主貸',     section: 'equity',    accountCodes: ['302'] },
  { key: 'ownerLoan',       label: '事業主借',     section: 'equity',    accountCodes: ['303'] },
  { key: 'netIncome',       label: '当期純利益',   section: 'equity',    computed: 'netIncome' },
]
