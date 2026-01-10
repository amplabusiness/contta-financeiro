/**
 * MAPEAMENTO: TELA → CONTA CONTÁBIL
 *
 * Cada tela consulta diretamente a conta contábil que precisa.
 * Quando um lançamento é alterado, o valor reflete imediatamente.
 *
 * Fórmula do Saldo:
 * - Contas DEVEDORAS (Ativo, Despesas): Saldo = Débitos - Créditos
 * - Contas CREDORAS (Passivo, Receitas, PL): Saldo = Créditos - Débitos
 */

import { supabase } from "@/integrations/supabase/client";

// =====================================================
// MAPEAMENTO TELA → CONTA CONTÁBIL
// =====================================================
export const ACCOUNT_MAPPING = {
  // Dashboard / CashFlow
  SALDO_BANCO_SICREDI: "1.1.1.05",      // Banco Sicredi (disponibilidades)
  CONTAS_A_RECEBER: "1.1.2.01",          // Clientes a Receber

  // Adiantamentos a Sócios (cada sócio tem sua conta)
  ADIANTAMENTO_SERGIO: "1.1.3.04.01",    // Adiantamento Sergio Carneiro
  ADIANTAMENTO_VICTOR: "1.1.3.04.02",    // Adiantamento Victor Hugo
  ADIANTAMENTO_JOSE: "1.1.3.04.03",      // Adiantamento José Carlos

  // DRE - Receitas (grupo 3)
  RECEITA_HONORARIOS: "3.1.1.01",        // Honorários Contábeis
  RECEITA_CONSULTORIA: "3.1.1.02",       // Honorários de Consultoria
  RECEITA_OUTRAS: "3.1.1.03",            // Outras Receitas

  // DRE - Despesas Administrativas (grupo 4.1)
  DESPESA_ALUGUEL: "4.1.01",             // Aluguel
  DESPESA_CONDOMINIO: "4.1.02",          // Condomínio
  DESPESA_ENERGIA: "4.1.03",             // Energia Elétrica
  DESPESA_AGUA: "4.1.04",                // Água e Esgoto
  DESPESA_TELEFONE: "4.1.05",            // Telefone e Internet
  DESPESA_MATERIAL: "4.1.06",            // Material de Escritório
  DESPESA_CORREIOS: "4.1.07",            // Correios e Transportes
  DESPESA_MANUTENCAO: "4.1.08",          // Manutenção e Reparos
  DESPESA_SEGUROS: "4.1.09",             // Seguros
  DESPESA_BANCARIAS: "4.1.10",           // Despesas Bancárias
  DESPESA_TARIFAS: "4.1.11",             // Tarifas e Taxas
  DESPESA_OUTRAS_ADM: "4.1.12",          // Outras Despesas Adm.

  // DRE - Despesas com Pessoal (grupo 4.2)
  DESPESA_SALARIOS: "4.2.01",            // Salários e Ordenados
  DESPESA_FERIAS: "4.2.02",              // Férias
  DESPESA_13_SALARIO: "4.2.03",          // 13º Salário
  DESPESA_FGTS: "4.2.04",                // FGTS
  DESPESA_INSS: "4.2.05",                // INSS
  DESPESA_VT: "4.2.06",                  // Vale Transporte
  DESPESA_VA: "4.2.07",                  // Vale Alimentação
  DESPESA_OUTRAS_PESSOAL: "4.2.08",      // Outras Despesas com Pessoal

  // DRE - Despesas Tributárias (grupo 4.3)
  DESPESA_ISS: "4.3.01",                 // ISS
  DESPESA_PIS: "4.3.02",                 // PIS
  DESPESA_COFINS: "4.3.03",              // COFINS
  DESPESA_IRPJ: "4.3.04",                // IRPJ
  DESPESA_CSLL: "4.3.05",                // CSLL
  DESPESA_OUTROS_TRIBUTOS: "4.3.06",     // Outros Impostos e Taxas

  // Passivo - Obrigações
  FORNECEDORES: "2.1.3.01",              // Fornecedores Nacionais
  CONTAS_A_PAGAR: "2.1.3.02",            // Contas a Pagar

  // Patrimônio Líquido
  CAPITAL_SOCIAL: "5.1.01",              // Capital Social Subscrito
  LUCROS_ACUMULADOS: "5.3.01",           // Lucros Acumulados
} as const;

// Tipo para as chaves do mapeamento
export type AccountKey = keyof typeof ACCOUNT_MAPPING;

// =====================================================
// FUNÇÕES HELPER PARA BUSCAR SALDOS
// =====================================================

/**
 * Busca o saldo de uma conta específica com formato de razão contábil:
 * SALDO INICIAL + DÉBITOS - CRÉDITOS = SALDO FINAL
 *
 * @param accountCode Código da conta (ex: "1.1.1.05")
 * @param year Ano (opcional)
 * @param month Mês (opcional)
 *
 * Retorna:
 * - openingBalance: Saldo inicial (antes do período)
 * - debit: Total de débitos no período
 * - credit: Total de créditos no período
 * - balance: Saldo final (openingBalance + debit - credit para DEVEDORA)
 */
export async function getAccountBalance(
  accountCode: string,
  year?: number,
  month?: number
): Promise<{
  code: string;
  name: string;
  openingBalance: number;  // Saldo Inicial
  debit: number;           // Débitos no período
  credit: number;          // Créditos no período
  balance: number;         // Saldo Final
  nature: string;
}> {
  // Buscar a conta
  const { data: account, error: accountError } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name, nature, account_type")
    .eq("code", accountCode)
    .single();

  if (accountError || !account) {
    console.warn(`Conta ${accountCode} não encontrada:`, accountError);
    return {
      code: accountCode,
      name: "Conta não encontrada",
      openingBalance: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      nature: "DEVEDORA",
    };
  }

  // Calcular datas do período
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (year && month) {
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    endDate = new Date(year, month, 0).toISOString().split("T")[0];
  } else if (year) {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  // =====================================================
  // 1. SALDO INICIAL: Lançamentos ANTES do período
  // =====================================================
  let openingBalance = 0;

  if (startDate) {
    const { data: priorEntries, error: priorError } = await supabase
      .from("accounting_entry_lines")
      .select("debit, credit, accounting_entries!inner(entry_date)")
      .eq("account_id", account.id)
      .lt("accounting_entries.entry_date", startDate)
      .range(0, 49999); // Garantir que todos os registros sejam retornados

    if (!priorError && priorEntries) {
      const priorDebit = priorEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
      const priorCredit = priorEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
      openingBalance = account.nature === "DEVEDORA"
        ? priorDebit - priorCredit
        : priorCredit - priorDebit;
    }
  }

  // =====================================================
  // 2. MOVIMENTOS DO PERÍODO: Débitos e Créditos
  // =====================================================
  let periodQuery = supabase
    .from("accounting_entry_lines")
    .select("debit, credit, accounting_entries!inner(entry_date)")
    .eq("account_id", account.id)
    .range(0, 49999); // Garantir que todos os registros sejam retornados

  if (startDate && endDate) {
    periodQuery = periodQuery
      .gte("accounting_entries.entry_date", startDate)
      .lte("accounting_entries.entry_date", endDate);
  }

  const { data: periodEntries, error: periodError } = await periodQuery;

  if (periodError) {
    console.error(`Erro ao buscar lançamentos da conta ${accountCode}:`, periodError);
    return {
      code: account.code,
      name: account.name,
      openingBalance: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      nature: account.nature,
    };
  }

  // Somar débitos e créditos do período
  const totalDebit = periodEntries?.reduce((sum, e) => sum + Number(e.debit || 0), 0) || 0;
  const totalCredit = periodEntries?.reduce((sum, e) => sum + Number(e.credit || 0), 0) || 0;

  // =====================================================
  // 3. SALDO FINAL: Saldo Inicial + Débitos - Créditos
  // =====================================================
  // Para conta DEVEDORA: SF = SI + D - C
  // Para conta CREDORA:  SF = SI + C - D
  const balance = account.nature === "DEVEDORA"
    ? openingBalance + totalDebit - totalCredit
    : openingBalance + totalCredit - totalDebit;

  return {
    code: account.code,
    name: account.name,
    openingBalance,
    debit: totalDebit,
    credit: totalCredit,
    balance,
    nature: account.nature,
  };
}

/**
 * Busca saldos de múltiplas contas de uma vez
 */
export async function getMultipleAccountBalances(
  accountCodes: string[],
  year?: number,
  month?: number
): Promise<Map<string, { code: string; name: string; balance: number }>> {
  const results = new Map();

  // Buscar todas em paralelo
  const promises = accountCodes.map((code) =>
    getAccountBalance(code, year, month)
  );
  const balances = await Promise.all(promises);

  balances.forEach((balance) => {
    results.set(balance.code, balance);
  });

  return results;
}

/**
 * Busca saldo de um grupo de contas (ex: todas as receitas "3%")
 *
 * Para grupos de contas:
 * - Grupo 1 (Ativo), 2 (Passivo), 5 (PL): saldo ACUMULADO
 * - Grupo 3 (Receitas), 4 (Despesas): saldo do PERÍODO
 */
export async function getAccountGroupBalance(
  groupPrefix: string,
  year?: number,
  month?: number
): Promise<{
  prefix: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  accounts: Array<{ code: string; name: string; balance: number }>;
}> {
  // Buscar todas as contas analíticas do grupo
  const { data: accounts, error: accountsError } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name, nature, account_type")
    .like("code", `${groupPrefix}%`)
    .eq("is_analytical", true)
    .eq("is_active", true);

  if (accountsError || !accounts?.length) {
    return {
      prefix: groupPrefix,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
      accounts: [],
    };
  }

  const accountIds = accounts.map((a) => a.id);

  // Determinar se é grupo patrimonial (1, 2, 5) ou de resultado (3, 4)
  const firstDigit = groupPrefix.charAt(0);
  const isPatrimonial = ["1", "2", "5"].includes(firstDigit);

  // Construir query
  let query = supabase
    .from("accounting_entry_lines")
    .select("account_id, debit, credit, accounting_entries!inner(entry_date)")
    .in("account_id", accountIds)
    .range(0, 49999); // Garantir que todos os registros sejam retornados

  // Filtrar por período
  if (isPatrimonial) {
    // Grupos patrimoniais: saldo ACUMULADO até o final do período
    if (year && month) {
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];
      query = query.lte("accounting_entries.entry_date", endDate);
    } else if (year) {
      query = query.lte("accounting_entries.entry_date", `${year}-12-31`);
    }
  } else {
    // Grupos de resultado: saldo do PERÍODO específico
    if (year && month) {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];
      query = query
        .gte("accounting_entries.entry_date", startDate)
        .lte("accounting_entries.entry_date", endDate);
    } else if (year) {
      query = query
        .gte("accounting_entries.entry_date", `${year}-01-01`)
        .lte("accounting_entries.entry_date", `${year}-12-31`);
    }
  }

  const { data: entries, error: entriesError } = await query;

  if (entriesError) {
    console.error(`Erro ao buscar lançamentos do grupo ${groupPrefix}:`, entriesError);
    return {
      prefix: groupPrefix,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
      accounts: [],
    };
  }

  // Agrupar por conta
  const accountMap = new Map<string, { debit: number; credit: number }>();
  entries?.forEach((e) => {
    const current = accountMap.get(e.account_id) || { debit: 0, credit: 0 };
    accountMap.set(e.account_id, {
      debit: current.debit + Number(e.debit || 0),
      credit: current.credit + Number(e.credit || 0),
    });
  });

  // Calcular saldos por conta
  const accountBalances = accounts.map((account) => {
    const totals = accountMap.get(account.id) || { debit: 0, credit: 0 };
    const balance =
      account.nature === "DEVEDORA"
        ? totals.debit - totals.credit
        : totals.credit - totals.debit;
    return {
      code: account.code,
      name: account.name,
      balance,
    };
  });

  // Totais do grupo
  let totalDebit = 0;
  let totalCredit = 0;
  accountMap.forEach((v) => {
    totalDebit += v.debit;
    totalCredit += v.credit;
  });

  // Saldo do grupo (assumindo natureza baseada no prefixo)
  // 1-2 = Ativo (Devedora), 3 = Receita (Credora), 4 = Despesa (Devedora), 5 = PL (Credora)
  // Reutiliza firstDigit declarado anteriormente
  const isDevedora = firstDigit === "1" || firstDigit === "4";
  const balance = isDevedora
    ? totalDebit - totalCredit
    : totalCredit - totalDebit;

  return {
    prefix: groupPrefix,
    totalDebit,
    totalCredit,
    balance,
    accounts: accountBalances.filter((a) => a.balance !== 0),
  };
}

// =====================================================
// FUNÇÕES PRONTAS PARA CADA TELA
// =====================================================

/**
 * Dashboard / CashFlow: Retorna saldos principais com formato de razão
 * Saldo Inicial + Débitos - Créditos = Saldo Final
 */
export async function getDashboardBalances(year?: number, month?: number) {
  const [saldoBanco, contasReceber, receitas, despesas] = await Promise.all([
    getAccountBalance(ACCOUNT_MAPPING.SALDO_BANCO_SICREDI, year, month),
    getAccountBalance(ACCOUNT_MAPPING.CONTAS_A_RECEBER, year, month),
    getAccountGroupBalance("3", year, month), // Todas as receitas
    getAccountGroupBalance("4", year, month), // Todas as despesas
  ]);

  return {
    // Banco - formato de razão
    saldoBanco: saldoBanco.balance,
    banco: {
      saldoInicial: saldoBanco.openingBalance,
      debitos: saldoBanco.debit,
      creditos: saldoBanco.credit,
      saldoFinal: saldoBanco.balance,
    },
    // Contas a Receber - formato de razão
    contasReceber: contasReceber.balance,
    receber: {
      saldoInicial: contasReceber.openingBalance,
      debitos: contasReceber.debit,
      creditos: contasReceber.credit,
      saldoFinal: contasReceber.balance,
    },
    // Receitas e Despesas
    totalReceitas: receitas.balance,
    totalDespesas: despesas.balance,
    resultado: receitas.balance - despesas.balance,
  };
}

/**
 * Adiantamentos a Sócios: Retorna saldo de cada sócio
 */
export async function getAdiantamentosSocios(year?: number, month?: number) {
  const [sergio, victor, jose] = await Promise.all([
    getAccountBalance(ACCOUNT_MAPPING.ADIANTAMENTO_SERGIO, year, month),
    getAccountBalance(ACCOUNT_MAPPING.ADIANTAMENTO_VICTOR, year, month),
    getAccountBalance(ACCOUNT_MAPPING.ADIANTAMENTO_JOSE, year, month),
  ]);

  return {
    sergio: sergio.balance,
    victor: victor.balance,
    jose: jose.balance,
    total: sergio.balance + victor.balance + jose.balance,
  };
}

/**
 * DRE: Retorna receitas e despesas detalhadas
 */
export async function getDREBalances(year: number, month?: number) {
  const [receitas, despesasAdm, despesasPessoal, despesasTrib, despesasFin] =
    await Promise.all([
      getAccountGroupBalance("3", year, month), // Receitas
      getAccountGroupBalance("4.1", year, month), // Despesas Administrativas
      getAccountGroupBalance("4.2", year, month), // Despesas com Pessoal
      getAccountGroupBalance("4.3", year, month), // Despesas Tributárias
      getAccountGroupBalance("4.4", year, month), // Despesas Financeiras
    ]);

  const totalDespesas =
    despesasAdm.balance +
    despesasPessoal.balance +
    despesasTrib.balance +
    despesasFin.balance;

  return {
    receitas: {
      total: receitas.balance,
      detalhes: receitas.accounts,
    },
    despesas: {
      administrativas: {
        total: despesasAdm.balance,
        detalhes: despesasAdm.accounts,
      },
      pessoal: {
        total: despesasPessoal.balance,
        detalhes: despesasPessoal.accounts,
      },
      tributarias: {
        total: despesasTrib.balance,
        detalhes: despesasTrib.accounts,
      },
      financeiras: {
        total: despesasFin.balance,
        detalhes: despesasFin.accounts,
      },
      total: totalDespesas,
    },
    resultado: receitas.balance - totalDespesas,
  };
}

/**
 * Balanço Patrimonial: Retorna ativo, passivo e PL
 */
export async function getBalancoPatrimonial(year: number, month?: number) {
  const [ativo, passivo, pl] = await Promise.all([
    getAccountGroupBalance("1", year, month), // Ativo
    getAccountGroupBalance("2", year, month), // Passivo
    getAccountGroupBalance("5", year, month), // Patrimônio Líquido
  ]);

  return {
    ativo: {
      total: ativo.balance,
      detalhes: ativo.accounts,
    },
    passivo: {
      total: passivo.balance,
      detalhes: passivo.accounts,
    },
    patrimonioLiquido: {
      total: pl.balance,
      detalhes: pl.accounts,
    },
    // Ativo = Passivo + PL (deve bater)
    conferencia: ativo.balance - (passivo.balance + pl.balance),
  };
}

// =====================================================
// INADIMPLÊNCIA - SALDOS POR CLIENTE (FONTE DA VERDADE)
// =====================================================

interface ClientReceivable {
  clientId: string;
  clientName: string;
  openingBalance: number;  // Saldo inicial (antes do período) - da tabela client_opening_balance
  debit: number;           // Débitos no período (novos valores a receber)
  credit: number;          // Créditos no período (recebimentos)
  balance: number;         // Saldo final (valor ainda a receber)
}

/**
 * Busca saldos de Clientes a Receber por cliente
 *
 * FONTE DA VERDADE PURA: accounting_entries + accounting_entry_lines
 * Extrai o nome do cliente diretamente da descrição do lançamento
 * Padrão: "Receita Honorarios: NOME DO CLIENTE" ou "Recebimento: ... NOME DO CLIENTE"
 *
 * Fórmula: Saldo Final = Saldo Inicial + Débitos - Créditos
 * - Débito na conta 1.1.2.01 = AUMENTO do valor a receber (nova fatura)
 * - Crédito na conta 1.1.2.01 = REDUÇÃO do valor a receber (recebimento)
 *
 * @param year Ano de referência
 * @param month Mês de referência (opcional)
 * @param clientId Filtrar por cliente específico (opcional) - usa o nome como ID
 */
export async function getReceivablesByClient(
  year: number,
  month?: number,
  clientId?: string
): Promise<{
  clients: ClientReceivable[];
  totalOpeningBalance: number;
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
  unlinkedCredits: number;
}> {
  // Buscar a conta 1.1.2.01 (Clientes a Receber)
  const { data: account, error: accountError } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .eq("code", ACCOUNT_MAPPING.CONTAS_A_RECEBER)
    .single();

  if (accountError || !account) {
    console.error("Conta 1.1.2.01 não encontrada:", accountError);
    return {
      clients: [],
      totalOpeningBalance: 0,
      totalDebit: 0,
      totalCredit: 0,
      totalBalance: 0,
      unlinkedCredits: 0,
    };
  }

  // Calcular datas do período
  let startDate: string;
  let endDate: string;

  if (month) {
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    endDate = new Date(year, month, 0).toISOString().split("T")[0];
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  // =====================================================
  // 1. SALDO INICIAL: Lançamentos ANTES do período
  // =====================================================
  const { data: priorEntries, error: priorError } = await supabase
    .from("accounting_entry_lines")
    .select(`
      debit,
      credit,
      accounting_entries!inner(entry_date, description)
    `)
    .eq("account_id", account.id)
    .lt("accounting_entries.entry_date", startDate);

  if (priorError) {
    console.error("Erro ao buscar lançamentos anteriores:", priorError);
  }

  // =====================================================
  // 2. MOVIMENTOS DO PERÍODO: Lançamentos no período
  // =====================================================
  const { data: periodEntries, error: periodError } = await supabase
    .from("accounting_entry_lines")
    .select(`
      debit,
      credit,
      accounting_entries!inner(entry_date, description)
    `)
    .eq("account_id", account.id)
    .gte("accounting_entries.entry_date", startDate)
    .lte("accounting_entries.entry_date", endDate);

  if (periodError) {
    console.error("Erro ao buscar lançamentos do período:", periodError);
  }

  // =====================================================
  // Função para extrair nome do cliente da descrição
  // Padrões: "Receita Honorarios: CLIENTE" ou "Recebimento: ... CLIENTE"
  // =====================================================
  const extractClientName = (description: string): string | null => {
    if (!description) return null;

    // IGNORAR: Saldo de Abertura (não é um cliente)
    if (description.toLowerCase().includes("saldo de abertura")) {
      return null;
    }

    // IGNORAR: Recebimentos via boleto sem identificação do cliente
    // Padrão: "Recebimento: LIQ.COBRANCA SIMPLES-COB000XXX"
    if (description.includes("LIQ.COBRANCA SIMPLES")) {
      return null;
    }

    // Padrão 1: "Receita Honorarios: NOME" - principal padrão de faturas
    const match1 = description.match(/Receita Honorarios?:\s*(.+)/i);
    if (match1) return match1[1].trim();

    // Padrão 2: "Honorarios: NOME"
    const match2 = description.match(/Honorarios?:\s*(.+)/i);
    if (match2) return match2[1].trim();

    // Padrão 3: Recebimento PIX com CNPJ (14 dígitos) seguido do nome
    // Ex: "Recebimento: RECEBIMENTO PIX-PIX_CRED 31458451000109 ACTION SOLUCOES INDU"
    const matchPIXCNPJ = description.match(/PIX.*?(\d{14})\s+(.+)/i);
    if (matchPIXCNPJ) return matchPIXCNPJ[2].trim();

    // Padrão 4: Recebimento PIX com CPF (11 dígitos) seguido do nome
    // Ex: "Recebimento: RECEBIMENTO PIX-PIX_CRED  83438718120 Paula Milhomem"
    const matchPIXCPF = description.match(/PIX.*?(\d{11})\s+(.+)/i);
    if (matchPIXCPF) return matchPIXCPF[2].trim();

    // Padrão 5: Recebimento PIX SICREDI com código específico
    // Ex: "Recebimento: RECEBIMENTO PIX SICREDI-CX553033 51859330000178 CANAL PET"
    const matchPIXSicredi = description.match(/SICREDI.*?(\d{14})\s+(.+)/i);
    if (matchPIXSicredi) return matchPIXSicredi[2].trim();

    // Não identificado - retorna null para não criar cliente falso
    return null;
  };

  // =====================================================
  // 3. AGRUPAR POR CLIENTE (usando nome como chave)
  // =====================================================
  const clientMap = new Map<string, {
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
  }>();

  // Rastrear valores não identificados (saldo de abertura global e recebimentos via boleto)
  let unidentifiedOpeningBalance = 0;
  let unidentifiedCredits = 0;

  // Processar saldos iniciais
  (priorEntries || []).forEach((entry: any) => {
    const clientName = extractClientName(entry.accounting_entries?.description || "");
    const debit = Number(entry.debit || 0);
    const credit = Number(entry.credit || 0);

    if (clientName === null) {
      // Lançamento não identificado (ex: Saldo de Abertura)
      unidentifiedOpeningBalance += debit - credit;
      return;
    }

    const current = clientMap.get(clientName) || {
      openingBalance: 0,
      periodDebit: 0,
      periodCredit: 0,
    };
    // Saldo inicial = débitos - créditos antes do período
    current.openingBalance += debit - credit;
    clientMap.set(clientName, current);
  });

  // Processar movimentos do período
  (periodEntries || []).forEach((entry: any) => {
    const clientName = extractClientName(entry.accounting_entries?.description || "");
    const debit = Number(entry.debit || 0);
    const credit = Number(entry.credit || 0);

    if (clientName === null) {
      // Recebimento não identificado (ex: boleto sem nome)
      unidentifiedCredits += credit;
      return;
    }

    const current = clientMap.get(clientName) || {
      openingBalance: 0,
      periodDebit: 0,
      periodCredit: 0,
    };
    current.periodDebit += debit;
    current.periodCredit += credit;
    clientMap.set(clientName, current);
  });

  // =====================================================
  // 4. MONTAR LISTA DE CLIENTES
  // =====================================================
  const clients: ClientReceivable[] = [];
  let totalOpeningBalance = unidentifiedOpeningBalance; // Começar com saldo de abertura global
  let totalDebit = 0;
  let totalCredit = unidentifiedCredits; // Incluir créditos não identificados
  let totalBalance = 0;

  clientMap.forEach((data, clientName) => {
    // Filtrar por cliente específico se fornecido
    if (clientId && clientName !== clientId) return;

    // Saldo final = Saldo inicial + Débitos - Créditos
    const balance = data.openingBalance + data.periodDebit - data.periodCredit;

    // Incluir apenas clientes com saldo positivo ou movimentação
    if (data.openingBalance > 0.01 || data.periodDebit > 0.01 || balance > 0.01) {
      clients.push({
        clientId: clientName, // Usar nome como ID já que não temos tabela clients
        clientName,
        openingBalance: data.openingBalance > 0 ? data.openingBalance : 0,
        debit: data.periodDebit,
        credit: data.periodCredit,
        balance: balance > 0 ? balance : 0,
      });

      if (data.openingBalance > 0) totalOpeningBalance += data.openingBalance;
      totalDebit += data.periodDebit;
      totalCredit += data.periodCredit;
      if (balance > 0) totalBalance += balance;
    }
  });

  // Ordenar por saldo final decrescente
  clients.sort((a, b) => b.balance - a.balance);

  // Calcular saldo total real: Saldo Inicial Global + Débitos - Créditos
  const realTotalBalance = unidentifiedOpeningBalance + totalDebit - totalCredit +
    Array.from(clientMap.values()).reduce((sum, c) => sum + c.openingBalance, 0);

  return {
    clients,
    totalOpeningBalance,
    totalDebit,
    totalCredit,
    totalBalance: realTotalBalance > 0 ? realTotalBalance : totalBalance,
    unlinkedCredits: unidentifiedCredits,
  };
}

/**
 * Busca detalhes dos lançamentos de um cliente específico na conta Clientes a Receber
 * Para exibir o extrato/razão do cliente
 *
 * FONTE DA VERDADE PURA: Busca diretamente dos accounting_entries + accounting_entry_lines
 * O clientId aqui é o NOME do cliente (extraído da descrição do lançamento)
 */
export async function getClientReceivablesDetail(
  clientId: string, // Na verdade é o nome do cliente
  year: number,
  month?: number
): Promise<Array<{
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  entryType: string;
}>> {
  // Buscar a conta 1.1.2.01
  const { data: account } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("code", ACCOUNT_MAPPING.CONTAS_A_RECEBER)
    .single();

  if (!account) return [];

  // O clientId passado é o nome do cliente (usado como ID em getReceivablesByClient)
  const clientName = clientId;

  // Calcular data final do período
  let endDate: string;
  if (month) {
    endDate = new Date(year, month, 0).toISOString().split("T")[0];
  } else {
    endDate = `${year}-12-31`;
  }

  // Buscar TODOS os lançamentos na conta Clientes a Receber até o período
  const { data: entries, error } = await supabase
    .from("accounting_entry_lines")
    .select(`
      debit,
      credit,
      description,
      accounting_entries!inner(
        entry_date,
        description,
        entry_type
      )
    `)
    .eq("account_id", account.id)
    .lte("accounting_entries.entry_date", endDate)
    .order("accounting_entries(entry_date)", { ascending: true });

  if (error || !entries) {
    console.error("Erro ao buscar lançamentos:", error);
    return [];
  }

  // Função para extrair nome do cliente da descrição (mesma lógica de getReceivablesByClient)
  const extractClientName = (description: string): string | null => {
    if (!description) return null;

    // IGNORAR: Saldo de Abertura (não é um cliente)
    if (description.toLowerCase().includes("saldo de abertura")) {
      return null;
    }

    // IGNORAR: Recebimentos via boleto sem identificação do cliente
    if (description.includes("LIQ.COBRANCA SIMPLES")) {
      return null;
    }

    // Padrão 1: "Receita Honorarios: NOME" - principal padrão de faturas
    const match1 = description.match(/Receita Honorarios?:\s*(.+)/i);
    if (match1) return match1[1].trim();

    // Padrão 2: "Honorarios: NOME"
    const match2 = description.match(/Honorarios?:\s*(.+)/i);
    if (match2) return match2[1].trim();

    // Padrão 3: Recebimento PIX com CNPJ (14 dígitos) seguido do nome
    const matchPIXCNPJ = description.match(/PIX.*?(\d{14})\s+(.+)/i);
    if (matchPIXCNPJ) return matchPIXCNPJ[2].trim();

    // Padrão 4: Recebimento PIX com CPF (11 dígitos) seguido do nome
    const matchPIXCPF = description.match(/PIX.*?(\d{11})\s+(.+)/i);
    if (matchPIXCPF) return matchPIXCPF[2].trim();

    // Padrão 5: Recebimento PIX SICREDI com código específico
    const matchPIXSicredi = description.match(/SICREDI.*?(\d{14})\s+(.+)/i);
    if (matchPIXSicredi) return matchPIXSicredi[2].trim();

    // Não identificado
    return null;
  };

  // Filtrar lançamentos deste cliente
  const clientEntries = entries.filter((e: any) => {
    const entryClientName = extractClientName(e.accounting_entries?.description || "");
    return entryClientName === clientName;
  });

  // Calcular saldo acumulado
  let runningBalance = 0;
  return clientEntries.map((e: any) => {
    const debit = Number(e.debit || 0);
    const credit = Number(e.credit || 0);
    runningBalance += debit - credit;

    return {
      date: e.accounting_entries.entry_date,
      description: e.description || e.accounting_entries.description,
      debit,
      credit,
      balance: runningBalance,
      entryType: e.accounting_entries.entry_type,
    };
  });
}

// =====================================================
// DESPESAS - FONTE DA VERDADE (accounting_entries)
// =====================================================

interface ExpenseEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  costCenterName?: string;
  entryType: string;
}

interface ExpenseSummary {
  accountCode: string;
  accountName: string;
  total: number;
  count: number;
}

/**
 * Busca despesas do período da FONTE DA VERDADE (accounting_entries)
 * Despesas são contas do grupo 4.* (débitos)
 *
 * @param year Ano de referência
 * @param month Mês de referência (opcional)
 */
export async function getExpenses(
  year: number,
  month?: number
): Promise<{
  entries: ExpenseEntry[];
  summary: ExpenseSummary[];
  totalExpenses: number;
}> {
  // Calcular datas do período
  let startDate: string;
  let endDate: string;

  if (month) {
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    endDate = new Date(year, month, 0).toISOString().split("T")[0];
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  // Buscar contas de despesas (grupo 4.*)
  const { data: expenseAccounts, error: accountsError } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .like("code", "4.%")
    .eq("is_analytical", true);

  if (accountsError) {
    console.error("Erro ao buscar contas de despesas:", accountsError);
    return { entries: [], summary: [], totalExpenses: 0 };
  }

  const accountIds = (expenseAccounts || []).map(a => a.id);
  const accountMap = new Map((expenseAccounts || []).map(a => [a.id, a]));

  if (accountIds.length === 0) {
    return { entries: [], summary: [], totalExpenses: 0 };
  }

  // Buscar lançamentos de despesas no período
  const { data: periodEntries, error: entriesError } = await supabase
    .from("accounting_entry_lines")
    .select(`
      id,
      debit,
      credit,
      description,
      account_id,
      accounting_entries!inner(
        id,
        entry_date,
        description,
        entry_type,
        cost_center_id
      )
    `)
    .in("account_id", accountIds)
    .gte("accounting_entries.entry_date", startDate)
    .lte("accounting_entries.entry_date", endDate)
    .gt("debit", 0); // Despesas = débitos em contas do grupo 4

  if (entriesError) {
    console.error("Erro ao buscar lançamentos de despesas:", entriesError);
    return { entries: [], summary: [], totalExpenses: 0 };
  }

  // Buscar centros de custo
  const costCenterIds = [...new Set((periodEntries || [])
    .filter(e => e.accounting_entries?.cost_center_id)
    .map(e => e.accounting_entries.cost_center_id))];

  const costCenterMap = new Map<string, string>();
  if (costCenterIds.length > 0) {
    const { data: costCenters } = await supabase
      .from("cost_centers")
      .select("id, name")
      .in("id", costCenterIds);

    (costCenters || []).forEach((cc: any) => {
      costCenterMap.set(cc.id, cc.name);
    });
  }

  // Mapear lançamentos
  const entries: ExpenseEntry[] = (periodEntries || []).map((e: any) => {
    const account = accountMap.get(e.account_id);
    return {
      id: e.id,
      date: e.accounting_entries.entry_date,
      description: e.description || e.accounting_entries.description,
      amount: Number(e.debit || 0),
      accountCode: account?.code || "",
      accountName: account?.name || "Conta não encontrada",
      costCenterId: e.accounting_entries.cost_center_id,
      costCenterName: costCenterMap.get(e.accounting_entries.cost_center_id) || undefined,
      entryType: e.accounting_entries.entry_type,
    };
  });

  // Ordenar por data decrescente
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calcular resumo por conta
  const summaryMap = new Map<string, ExpenseSummary>();
  entries.forEach(e => {
    const key = e.accountCode;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.total += e.amount;
      existing.count += 1;
    } else {
      summaryMap.set(key, {
        accountCode: e.accountCode,
        accountName: e.accountName,
        total: e.amount,
        count: 1,
      });
    }
  });

  const summary = Array.from(summaryMap.values()).sort((a, b) => b.total - a.total);
  const totalExpenses = entries.reduce((sum, e) => sum + e.amount, 0);

  return {
    entries,
    summary,
    totalExpenses,
  };
}

// =====================================================
// CONTAS A PAGAR - FONTE DA VERDADE (accounting_entries)
// Passivo Circulante - Grupo 2.1.x
// =====================================================

interface PayableEntry {
  id: string;
  date: string;
  dueDate?: string;
  description: string;
  supplier: string;
  amount: number;
  accountCode: string;
  accountName: string;
  status: "pending" | "paid" | "partial";
  paidAmount: number;
  entryId: string;
}

interface PayableSummary {
  accountCode: string;
  accountName: string;
  totalPending: number;
  totalPaid: number;
  count: number;
}

/**
 * Busca Contas a Pagar da FONTE DA VERDADE (accounting_entries)
 * Contas a Pagar são contas do grupo 2.1.x (passivo circulante)
 *
 * Lógica contábil:
 * - Provisão de despesa: D - Despesa (4.x) / C - Contas a Pagar (2.1.x)
 *   → CRÉDITO aumenta saldo de Contas a Pagar
 * - Pagamento: D - Contas a Pagar (2.1.x) / C - Banco (1.1.1.x)
 *   → DÉBITO reduz saldo de Contas a Pagar
 *
 * Fórmula (conta CREDORA): Saldo = Créditos - Débitos
 * Se Saldo > 0 → Valor ainda a pagar
 *
 * @param year Ano de referência
 * @param month Mês de referência (opcional)
 */
export async function getAccountsPayable(
  year: number,
  month?: number
): Promise<{
  entries: PayableEntry[];
  summary: PayableSummary[];
  totalPending: number;
  totalPaid: number;
}> {
  // Calcular datas do período
  let endDate: string;

  if (month) {
    endDate = new Date(year, month, 0).toISOString().split("T")[0];
  } else {
    endDate = `${year}-12-31`;
  }

  // Buscar contas de passivo circulante (grupo 2.1.*)
  const { data: liabilityAccounts, error: accountsError } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .like("code", "2.1.%")
    .eq("is_analytical", true);

  if (accountsError) {
    console.error("Erro ao buscar contas de passivo:", accountsError);
    return { entries: [], summary: [], totalPending: 0, totalPaid: 0 };
  }

  const accountIds = (liabilityAccounts || []).map(a => a.id);
  const accountMap = new Map((liabilityAccounts || []).map(a => [a.id, a]));

  if (accountIds.length === 0) {
    return { entries: [], summary: [], totalPending: 0, totalPaid: 0 };
  }

  // Buscar TODOS os lançamentos nas contas de passivo até o período
  const { data: allEntries, error: entriesError } = await supabase
    .from("accounting_entry_lines")
    .select(`
      id,
      debit,
      credit,
      description,
      account_id,
      accounting_entries!inner(
        id,
        entry_date,
        description,
        entry_type,
        reference_type,
        reference_id
      )
    `)
    .in("account_id", accountIds)
    .lte("accounting_entries.entry_date", endDate);

  if (entriesError) {
    console.error("Erro ao buscar lançamentos de contas a pagar:", entriesError);
    return { entries: [], summary: [], totalPending: 0, totalPaid: 0 };
  }

  // =====================================================
  // Função para extrair fornecedor da descrição
  // =====================================================
  const extractSupplier = (description: string): string => {
    if (!description) return "Não identificado";

    // Padrão 1: "Provisão: FORNECEDOR" ou "Despesa: FORNECEDOR"
    const matchProvisao = description.match(/(?:Provisão|Despesa|Pagamento):\s*(.+)/i);
    if (matchProvisao) return matchProvisao[1].trim().substring(0, 50);

    // Padrão 2: "FORNECEDOR - Descrição"
    const matchDash = description.match(/^([^-]+)\s*-/);
    if (matchDash && matchDash[1].trim().length > 2) return matchDash[1].trim().substring(0, 50);

    // Padrão 3: "Pgto FORNECEDOR" ou "Pag. FORNECEDOR"
    const matchPgto = description.match(/(?:Pgto|Pag\.?)\s+(.+)/i);
    if (matchPgto) return matchPgto[1].trim().substring(0, 50);

    // Se nada funcionar, usar início da descrição
    return description.substring(0, 50);
  };

  // =====================================================
  // Agrupar por lançamento de origem (provisão)
  // Uma provisão pode ter múltiplos pagamentos parciais
  // =====================================================
  const payableMap = new Map<string, {
    id: string;
    date: string;
    description: string;
    supplier: string;
    accountId: string;
    totalCredit: number;  // Valor provisionado
    totalDebit: number;   // Valor pago
    entryId: string;
  }>();

  // Processar todos os lançamentos
  (allEntries || []).forEach((line: any) => {
    const entry = line.accounting_entries;
    const credit = Number(line.credit || 0);
    const debit = Number(line.debit || 0);
    const description = line.description || entry.description || "";

    // Usar a descrição como chave para agrupar (provisão + pagamentos)
    // Alternativamente, pode usar reference_id se disponível
    const key = `${line.account_id}_${description.toLowerCase().trim()}`;

    const existing = payableMap.get(key);
    if (existing) {
      existing.totalCredit += credit;
      existing.totalDebit += debit;
    } else {
      payableMap.set(key, {
        id: line.id,
        date: entry.entry_date,
        description,
        supplier: extractSupplier(description),
        accountId: line.account_id,
        totalCredit: credit,
        totalDebit: debit,
        entryId: entry.id,
      });
    }
  });

  // =====================================================
  // Montar lista de contas a pagar
  // =====================================================
  const entries: PayableEntry[] = [];
  const summaryMap = new Map<string, PayableSummary>();

  payableMap.forEach((data) => {
    const account = accountMap.get(data.accountId);
    const saldo = data.totalCredit - data.totalDebit; // Conta CREDORA

    // Só incluir se teve provisão (crédito)
    if (data.totalCredit <= 0) return;

    let status: "pending" | "paid" | "partial" = "pending";
    if (saldo <= 0.01) {
      status = "paid";
    } else if (data.totalDebit > 0) {
      status = "partial";
    }

    const entry: PayableEntry = {
      id: data.id,
      date: data.date,
      description: data.description,
      supplier: data.supplier,
      amount: data.totalCredit,
      accountCode: account?.code || "",
      accountName: account?.name || "Conta não encontrada",
      status,
      paidAmount: data.totalDebit,
      entryId: data.entryId,
    };
    entries.push(entry);

    // Atualizar resumo por conta
    const accountCode = account?.code || "";
    const existing = summaryMap.get(accountCode);
    if (existing) {
      existing.totalPending += saldo > 0 ? saldo : 0;
      existing.totalPaid += data.totalDebit;
      existing.count += 1;
    } else {
      summaryMap.set(accountCode, {
        accountCode,
        accountName: account?.name || "Conta não encontrada",
        totalPending: saldo > 0 ? saldo : 0,
        totalPaid: data.totalDebit,
        count: 1,
      });
    }
  });

  // Ordenar por data decrescente
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const summary = Array.from(summaryMap.values()).sort((a, b) => b.totalPending - a.totalPending);
  const totalPending = entries.reduce((sum, e) => sum + (e.amount - e.paidAmount), 0);
  const totalPaid = entries.reduce((sum, e) => sum + e.paidAmount, 0);

  return {
    entries,
    summary,
    totalPending: totalPending > 0 ? totalPending : 0,
    totalPaid,
  };
}

/**
 * Busca saldo de Contas a Pagar por conta específica
 * Retorna o saldo atual (pendente de pagamento)
 */
export async function getPayableBalance(
  accountCode: string,
  year?: number,
  month?: number
): Promise<{
  code: string;
  name: string;
  totalProvisioned: number;
  totalPaid: number;
  balance: number;
}> {
  const balance = await getAccountBalance(accountCode, year, month);

  // Para conta CREDORA (passivo), saldo positivo = valor a pagar
  return {
    code: balance.code,
    name: balance.name,
    totalProvisioned: balance.credit,
    totalPaid: balance.debit,
    balance: balance.balance, // Já calculado corretamente para conta CREDORA
  };
}
