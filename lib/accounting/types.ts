export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type Side = 'debit' | 'credit'

export interface Account {
  id: string
  code: string
  name: string
  category: AccountCategory
  normalBalance: Side
  isActive: boolean
  sortOrder: number
}

export interface JournalLineInput {
  accountId: string
  side: Side
  amount: number
}

export interface JournalEntryInput {
  entryDate: string
  description: string
  lines: JournalLineInput[]
}

export interface OpeningBalance {
  accountId: string
  side: Side
  amount: number
}
