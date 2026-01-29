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
      .filter((t) => Number(t.balance) !== 0);

    if (pendingTransitories.length > 0) {
      mustFix.push(
        `Zerar contas transitórias pendentes: ${pendingTransitories
          .map((t) => `${t.code} (saldo ${t.balance})`)
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
      classification_plan: pendingTransitories.map((t) => ({
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
