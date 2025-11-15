import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Type for Supabase client used in Edge Functions
export type EdgeSupabaseClient = SupabaseClient<any>

// Common database row types
export interface BankTransaction {
  id: string
  account_id: string
  transaction_date: string
  amount: number
  description: string | null
  bank_reference: string | null
  invoice_id: string | null
  created_at?: string
}

export interface Invoice {
  id: string
  client_id: string
  competence: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  payment_date: string | null
  created_at?: string
  clients?: {
    id: string
    name: string
    cnpj: string | null
  }
}

export interface ChartOfAccount {
  id: string
  code: string
  name: string
  is_analytical: boolean
  account_type: string
  created_at?: string
}

export interface AccountingEntry {
  id: string
  entry_date: string
  competence_date?: string
  description: string
  history?: string
  entry_type: string
  document_type?: string
  document_number?: string
  invoice_id?: string | null
  transaction_id?: string | null
  total_debit: number
  total_credit: number
  is_draft: boolean
  created_at?: string
}

export interface AccountingEntryItem {
  id?: string
  entry_id: string
  account_id: string
  debit: number
  credit: number
  history?: string
  client_id?: string | null
  created_at?: string
}

export interface Client {
  id: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  status: 'active' | 'inactive'
  created_at?: string
}

// Reconciliation types
export interface MatchCriteria {
  exactAmount?: boolean
  approximateAmount?: boolean
  nameInDescription?: boolean
  partialNameMatch?: boolean
  matchedWords?: number
  cnpjMatch?: boolean
  dateProximity?: boolean
  approximateDateProximity?: boolean
  manualReconciliation?: boolean
}

export interface ReconciliationMatch {
  transactionId: string
  invoiceId: string
  clientId: string
  clientName: string
  matchMethod: 'AUTO_EXACT' | 'AUTO_FUZZY' | 'MANUAL'
  confidenceScore: number
  matchCriteria: MatchCriteria
}

export interface ReconciliationResult {
  processed: number
  matched: number
  unmatched: number
  entriesCreated: number
  matches: ReconciliationMatch[]
  unmatchedTransactions: Array<{
    transaction: BankTransaction
    possibleMatches?: any[]
    error?: string
  }>
}

export interface BestMatch {
  invoice: Invoice
  matchMethod: 'AUTO_EXACT' | 'AUTO_FUZZY'
  confidenceScore: number
  matchCriteria: MatchCriteria
}

export interface ReconciliationConfig {
  startDate?: string
  endDate?: string
  accountId?: string
}

export interface ChartOfAccounts {
  honorariosAReceber: ChartOfAccount
  bancosContaMovimento: ChartOfAccount
  caixa: ChartOfAccount
  receitaHonorarios: ChartOfAccount
}
