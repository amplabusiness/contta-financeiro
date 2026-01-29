export type UUID = string;

export type Period = {
  year: number; // 2025
  month: number; // 1..12
};

export type Money = string; // manter como string (decimal) vindo do Postgres: "2604.90"

export type TransitoryBalance = {
  code: string; // "1.1.9.01"
  name: string; // "Pendente de Classificação - Débitos"
  total_debit: Money;
  total_credit: Money;
  balance: Money;
  status?: string; // opcional: "✅ ZERADA"
};

export type TrialBalanceRow = {
  account_id: UUID;
  code: string; // "3.01.01.01"
  name: string;
  debit: Money;
  credit: Money;
  balance: Money; // saldo do mês
};

export type DRELine = {
  code: string; // "3.01" receita / "4.01" custos / "5.01" despesas...
  name: string;
  amount: Money;
};

export type BankReconciliationSummary = {
  total_transactions: number;
  reconciled: number;
  not_reconciled: number;
  total_inflows: Money;
  total_outflows: Money;
};

export type IntegrityCheck = {
  ok: boolean;
  warnings: string[];
  errors: string[];
};

export type ClosingInput = {
  tenant_id: UUID;
  period: Period;

  // Insumos obrigatórios (RAG-ready)
  chart_of_accounts_version: string; // ex: hash/versão do plano de contas
  transitory_balances: TransitoryBalance[];
  trial_balance: TrialBalanceRow[];
  dre: DRELine[];
  bank_reconciliation: BankReconciliationSummary;

  // “provas” e trilha de auditoria
  integrity: IntegrityCheck;
  generated_at: string; // ISO date
  generated_by: UUID; // usuário/sistema
};

export type CiceroDecision = {
  authorized: boolean; // ✅ libera fechamento?
  must_fix_before_close: string[]; // lista de pendências obrigatórias
  recommendations: string[]; // melhorias não-bloqueantes
  classification_plan: Array<{
    // ações sugeridas (pode virar SQL/RPC depois)
    action: "RECLASSIFY" | "ADJUST" | "INVESTIGATE";
    reference?: string; // ex: "1.1.9.01"
    description: string;
    target_account_code?: string;
    target_account_name?: string;
    amount?: Money;
  }>;

  // auditoria
  reasoning: string; // justificativa técnica (NBC/boas práticas)
  confidence: number; // 0..1
};

export type CiceroResult = {
  decision_id: UUID;
  tenant_id: UUID;
  period: Period;

  input_hash: string; // hash dos insumos (imutabilidade)
  model: string; // ex: "gpt-5.2-thinking"
  prompt_version: string; // versão do prompt oficial do Dr. Cícero
  created_at: string; // ISO
  created_by: UUID;

  decision: CiceroDecision;
};

export interface DrCiceroService {
  evaluate(input: ClosingInput): Promise<CiceroResult>;
}
