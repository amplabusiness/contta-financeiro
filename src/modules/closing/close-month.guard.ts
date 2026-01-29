export async function ensureMonthCanClose(
  deps: {
    findApprovedDecision: (
      tenant_id: string,
      year: number,
      month: number,
      input_hash: string
    ) => Promise<boolean>;
  },
  args: { tenant_id: string; year: number; month: number; input_hash: string; }
) {
  const ok = await deps.findApprovedDecision(
    args.tenant_id,
    args.year,
    args.month,
    args.input_hash
  );

  if (!ok) {
    throw new Error(
      "Fechamento negado: não existe parecer aprovado do Dr. Cícero compatível com os dados atuais (hash diferente ou ausente)."
    );
  }
}
