Perfeito. Vamos criar o CONTRATO DE FUNÇÃO do Dr. Cícero (backend) de um jeito auditável, travado e RAG-ready.

A ideia: o sistema só fecha mês se existir um parecer do Dr. Cícero com authorized=true, assinado com hash dos insumos (balancete, DRE, transitórias, banco etc.). Se qualquer insumo mudar, o hash muda e o fechamento perde validade.

1) Contrato do Dr. Cícero (TypeScript)
// src/modules/closing/dr-cicero.contract.ts

export type UUID = string;

export type Period = {
  year: number;  // 2025
  month: number; // 1..12
};

export type Money = string; // manter como string (decimal) vindo do Postgres: "2604.90"

export type TransitoryBalance = {
  code: string;            // "1.1.9.01"
  name: string;            // "Pendente de Classificação - Débitos"
  total_debit: Money;
  total_credit: Money;
  balance: Money;
  status?: string;         // opcional: "✅ ZERADA"
};

export type TrialBalanceRow = {
  account_id: UUID;
  code: string;            // "3.01.01.01"
  name: string;
  debit: Money;
  credit: Money;
  balance: Money;          // saldo do mês
};

export type DRELine = {
  code: string;            // "3.01" receita / "4.01" custos / "5.01" despesas...
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
  generated_by: UUID;   // usuário/sistema
};

export type CiceroDecision = {
  authorized: boolean;         // ✅ libera fechamento?
  must_fix_before_close: string[]; // lista de pendências obrigatórias
  recommendations: string[];   // melhorias não-bloqueantes
  classification_plan: Array<{
    // ações sugeridas (pode virar SQL/RPC depois)
    action: "RECLASSIFY" | "ADJUST" | "INVESTIGATE";
    reference?: string;        // ex: "1.1.9.01"
    description: string;
    target_account_code?: string;
    target_account_name?: string;
    amount?: Money;
  }>;

  // auditoria
  reasoning: string;           // justificativa técnica (NBC/boas práticas)
  confidence: number;          // 0..1
};

export type CiceroResult = {
  decision_id: UUID;
  tenant_id: UUID;
  period: Period;

  input_hash: string;          // hash dos insumos (imutabilidade)
  model: string;               // ex: "gpt-5.2-thinking"
  prompt_version: string;      // versão do prompt oficial do Dr. Cícero
  created_at: string;          // ISO
  created_by: UUID;

  decision: CiceroDecision;
};

export interface DrCiceroService {
  evaluate(input: ClosingInput): Promise<CiceroResult>;
}

2) Hash imutável dos insumos (bloqueio real)
// src/modules/closing/hash.ts
import crypto from "crypto";

export function stableJsonStringify(obj: unknown): string {
  // ordena chaves para garantir hash estável
  const seen = new WeakSet();
  const stringify = (value: any): any => {
    if (value && typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);

      if (Array.isArray(value)) return value.map(stringify);

      return Object.keys(value)
        .sort()
        .reduce((acc: any, key: string) => {
          acc[key] = stringify(value[key]);
          return acc;
        }, {});
    }
    return value;
  };

  return JSON.stringify(stringify(obj));
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashClosingInput(input: object): string {
  return sha256(stableJsonStringify(input));
}

3) Tabela no Postgres (Supabase) para parecer + auditoria
-- migrations/20260129_create_accounting_closures.sql

create table if not exists accounting_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  year int not null,
  month int not null,

  status text not null default 'DRAFT', -- DRAFT | APPROVED | CLOSED | INVALIDATED
  input_hash text not null,

  model text not null,
  prompt_version text not null,

  decision jsonb not null,     -- CiceroDecision
  reasoning text not null,     -- redundante pra busca
  confidence numeric not null,

  created_at timestamptz not null default now(),
  created_by uuid not null,

  approved_at timestamptz,
  closed_at timestamptz,

  unique (tenant_id, year, month, input_hash)
);

create index if not exists idx_closures_tenant_period
  on accounting_closures (tenant_id, year, month);

create index if not exists idx_closures_status
  on accounting_closures (status);

create index if not exists idx_closures_decision_gin
  on accounting_closures using gin (decision);

4) Serviço do Dr. Cícero (só libera se estiver “limpo”)

Aqui é onde você pluga seu provider de IA (OpenAI/Claude etc.) + RAG depois. Por enquanto, a regra mínima é objetiva: transitórias devem estar zeradas e integrity sem erro.

// src/modules/closing/dr-cicero.service.ts
import { DrCiceroService, ClosingInput, CiceroResult } from "./dr-cicero.contract";
import { hashClosingInput } from "./hash";

export class DrCiceroServiceImpl implements DrCiceroService {
  constructor(
    private readonly deps: {
      saveResult: (result: Omit<CiceroResult, "decision_id">) => Promise<CiceroResult>;
      modelName: string;
      promptVersion: string;
    }
  ) {}

  async evaluate(input: ClosingInput): Promise<CiceroResult> {
    const input_hash = hashClosingInput(input);

    const errors: string[] = [];
    const mustFix: string[] = [];
    const recs: string[] = [];

    if (!input.integrity.ok) {
      errors.push(...input.integrity.errors);
      mustFix.push("Corrigir erros de integridade contábil antes do fechamento.");
    }

    const pendingTransitories = input.transitory_balances
      .filter(t => Number(t.balance) !== 0);

    if (pendingTransitories.length > 0) {
      mustFix.push(
        `Zerar contas transitórias pendentes: ${pendingTransitories
          .map(t => `${t.code} (saldo ${t.balance})`)
          .join(", ")}`
      );
    }

    // Regra extra (boa prática): reconciliação bancária deve estar 100% ou justificada
    if (input.bank_reconciliation.not_reconciled > 0) {
      recs.push("Existem transações bancárias não conciliadas; justificar ou conciliar antes de fechar.");
    }

    const authorized = errors.length === 0 && mustFix.length === 0;

    const decision = {
      authorized,
      must_fix_before_close: mustFix,
      recommendations: recs,
      classification_plan: pendingTransitories.map(t => ({
        action: "RECLASSIFY" as const,
        reference: t.code,
        description: `Classificar saldo pendente da transitória ${t.code}.`,
        amount: t.balance
      })),
      reasoning: authorized
        ? "Competência revisada: sem erros de integridade e sem saldo em transitórias. Libero fechamento."
        : "Não libero fechamento: existem pendências objetivas (integridade/transitórias).",
      confidence: authorized ? 0.85 : 0.9
    };

    const resultToSave: Omit<CiceroResult, "decision_id"> = {
      tenant_id: input.tenant_id,
      period: input.period,
      input_hash,
      model: this.deps.modelName,
      prompt_version: this.deps.promptVersion,
      created_at: new Date().toISOString(),
      created_by: input.generated_by,
      decision
    };

    return this.deps.saveResult(resultToSave);
  }
}

5) Endpoint (API) que gera o parecer e grava
// src/routes/closing.routes.ts
import { Router } from "express";
import { DrCiceroService } from "../modules/closing/dr-cicero.contract";

export function closingRoutes(drCicero: DrCiceroService) {
  const r = Router();

  // Gera parecer oficial do Dr. Cícero para o mês
  r.post("/closing/evaluate", async (req, res) => {
    try {
      const input = req.body; // validar com zod em produção
      const result = await drCicero.evaluate(input);
      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  return r;
}

6) Regra de bloqueio no FECHAMENTO (o pulo do gato)

Quando alguém tentar fechar o mês, seu backend deve:

recomputar os insumos

gerar hash atual

buscar APPROVED com o mesmo hash

se não existir: nega

// src/modules/closing/close-month.guard.ts

export async function ensureMonthCanClose(deps: {
  findApprovedDecision: (tenant_id: string, year: number, month: number, input_hash: string) => Promise<boolean>;
}, args: { tenant_id: string; year: number; month: number; input_hash: string; }) {

  const ok = await deps.findApprovedDecision(args.tenant_id, args.year, args.month, args.input_hash);

  if (!ok) {
    throw new Error("Fechamento negado: não existe parecer aprovado do Dr. Cícero compatível com os dados atuais (hash diferente ou ausente).");
  }
}

✅ O QUE VOCÊ PEDE PARA O VSCode AGORA (COMANDO ÚNICO)

Copie e cole isso para o agente:

“Implemente o contrato do Dr. Cícero conforme dr-cicero.contract.ts + hash estável + tabela accounting_closures. Depois, crie o endpoint POST /closing/evaluate que grava o parecer. Por fim, bloqueie o fechamento do mês exigindo decisão APPROVED com input_hash igual aos insumos atuais.”