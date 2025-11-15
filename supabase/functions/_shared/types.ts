import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Type for Supabase client used in Edge Functions
export type EdgeSupabaseClient = SupabaseClient<any>

// Transaction processing types
export interface Transaction {
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  reference?: string
}

export interface OFXTransaction {
  date?: string
  amount?: string
  memo?: string
  payee?: string
  fitid?: string
}

export interface ReconciliationRule {
  pattern: string
  rule_type: string
  rule_name: string
  auto_match?: boolean
  target_category?: string | null
  target_account_id?: string | null
  priority?: number
}

export interface Expense {
  id: string
  description: string
  amount: number
  due_date: string
  status: string
  category?: string
  payment_date?: string | null
}

// Brasil API types
export interface BrasilAPISocio {
  nome_socio?: string
  nome?: string
  qualificacao_socio?: string
  qual?: string
  data_entrada_sociedade?: string
}

export interface Socio {
  nome: string
  qualificacao: string
  data_entrada?: string
}

export interface BrasilAPIResponse {
  razao_social?: string
  nome_fantasia?: string
  porte?: string
  natureza_juridica?: string
  situacao_cadastral?: string
  descricao_situacao_cadastral?: string
  data_situacao_cadastral?: string
  motivo_situacao_cadastral?: string
  data_inicio_atividade?: string
  cnae_fiscal?: string
  cnae_fiscal_descricao?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
  ddd_fax?: string
  email?: string
  capital_social?: string
  opcao_pelo_simples?: boolean
  data_opcao_simples?: string
  data_opcao_pelo_simples?: string
  opcao_pelo_mei?: boolean
  cnaes_secundarios?: Array<{codigo: number, descricao: string}>
  qsa?: BrasilAPISocio[]
}

// Boleto types
export interface BoletoData {
  clientName: string
  clientCnpj?: string
  boletoNumber: string
  emissionDate: string
  dueDate: string
  paymentDate?: string
  competence: string // Ex: "01/2025"
  amount: number
  status: 'EMITIDO' | 'PAGO' | 'VENCIDO' | 'CANCELADO'
  paymentMethod?: 'BOLETO' | 'PIX' | 'TED' | 'DINHEIRO'
}

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
  competence: string | null
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue' | 'cancelled'
  payment_date: string | null
  description?: string | null
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

export interface ExtendedChartOfAccounts extends ChartOfAccounts {
  boletosAReceber: ChartOfAccount
  issRecolher: ChartOfAccount
  pisRecolher: ChartOfAccount
  cofinsRecolher: ChartOfAccount
}
