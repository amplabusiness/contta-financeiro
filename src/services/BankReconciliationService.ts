/**
 * =============================================================================
 * SERVIÇO DE CONCILIAÇÃO BANCÁRIA - AMPLA CONTABILIDADE
 * =============================================================================
 *
 * Este serviço realiza a conciliação entre:
 * - Extrato bancário (arquivo OFX)
 * - Planilha de boletos liquidados (arquivo CSV)
 *
 * FLUXO DE CONCILIAÇÃO:
 * 1. Parse do OFX → Extrai transações com classificação automática
 * 2. Parse do CSV → Extrai boletos com agrupamento por COB + data
 * 3. Match → Cruza créditos do OFX com boletos do CSV pelo COB number
 * 4. Relatório → Gera resumo de conciliados, divergentes e pendentes
 *
 * BANCO SUPORTADO: SICOOB (748)
 *
 * Dr. Cícero - Documentação para acompanhamento
 * =============================================================================
 */

import { OFXTransaction, OFXStatement, parseOFX } from '@/lib/ofxParser';
import { parseCSV, parseBrazilianCurrency, parseDate } from '@/lib/csvParser';

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

/**
 * Classificação de transação do OFX
 * Baseado nos padrões do MEMO do SICOOB
 */
export type TransactionClassification =
  | 'RECEBIMENTO_BOLETO'    // LIQ.COBRANCA SIMPLES-COBxxxxxx
  | 'RECEBIMENTO_PIX'       // RECEBIMENTO PIX-PIX_CRED
  | 'PAGAMENTO_PIX'         // PAGAMENTO PIX-PIX_DEB
  | 'PAGAMENTO_BOLETO'      // LIQUIDACAO BOLETO-
  | 'DEBITO_CONVENIO'       // DEBITO CONVENIOS-
  | 'TARIFA_LIQUIDACAO'     // TARIFA COM R LIQUIDACAO-
  | 'TARIFA_MANUTENCAO'     // MANUTENCAO DE TITULOS-
  | 'TARIFA_CESTA'          // CESTA DE RELACIONAMENTO
  | 'OUTROS';

/**
 * Transação do OFX enriquecida com classificação
 */
export interface ClassifiedTransaction extends OFXTransaction {
  classification: TransactionClassification;
  cobNumber?: string;        // COBxxxxxx extraído do MEMO
  cnpjCpf?: string;          // CNPJ/CPF extraído do MEMO
  payerName?: string;        // Nome do pagador extraído do MEMO
  isReconciled?: boolean;    // Se já foi conciliado
  reconciliationNotes?: string;
}

/**
 * Boleto do CSV
 */
export interface BoletoCSV {
  documento: string;           // COB number
  nossoNumero: string;         // Número do boleto
  pagador: string;             // Razão social do cliente
  dataVencimento: Date | null;
  dataLiquidacao: Date | null;
  valorBoleto: number;
  valorRecebido: number;
  dataExtrato: Date | null;
  jurosMulta: number;          // Diferença entre recebido e boleto
}

/**
 * Agrupamento de boletos por COB + data do extrato
 */
export interface BoletoGroup {
  cobNumber: string;
  dataExtrato: Date | null;
  boletos: BoletoCSV[];
  totalBoleto: number;
  totalRecebido: number;
  totalJurosMulta: number;
  quantidadeBoletos: number;
}

/**
 * Resultado da conciliação de um lote
 */
export interface ReconciliationMatch {
  cobNumber: string;
  dataExtratoOFX: Date;
  valorCreditoOFX: number;
  somaBoletosCsv: number;
  diferenca: number;
  tarifaAssociada: number;
  liquidoReal: number;
  status: 'CONCILIADO' | 'DIVERGENTE' | 'SEM_EXTRATO' | 'SEM_BOLETO';
  boletos: BoletoCSV[];
  transacaoOFX?: ClassifiedTransaction;
  tarifasOFX: ClassifiedTransaction[];
}

/**
 * Resumo geral da conciliação
 */
export interface ReconciliationSummary {
  periodo: { inicio: Date; fim: Date };
  totalCreditosOFX: number;
  totalBoletosCSV: number;
  diferencaTotal: number;
  lotesConciliados: number;
  lotesComDivergencia: number;
  boletosSemExtrato: number;
  creditosPIX: number;
  totalTarifas: number;
  matches: ReconciliationMatch[];
  transacoesPIX: ClassifiedTransaction[];
  transacoesNaoClassificadas: ClassifiedTransaction[];
}

// =============================================================================
// PADRÕES DE CLASSIFICAÇÃO DO MEMO (SICOOB)
// =============================================================================

const CLASSIFICATION_PATTERNS: Record<TransactionClassification, RegExp> = {
  RECEBIMENTO_BOLETO: /LIQ\.COBRANCA SIMPLES-COB(\d{6})/i,
  RECEBIMENTO_PIX: /RECEBIMENTO PIX-PIX_CRED\s+(\S+)\s+(.*)/i,
  PAGAMENTO_PIX: /PAGAMENTO PIX-PIX_DEB\s+(\S+)\s+(.*)/i,
  PAGAMENTO_BOLETO: /LIQUIDACAO BOLETO-\s+(\d{11,14})\s+(.*)/i,
  DEBITO_CONVENIO: /DEBITO CONVENIOS-(\S+)\s+(\d{11,14})?\s*(.*)/i,
  TARIFA_LIQUIDACAO: /TARIFA COM R LIQUIDACAO-COB(\d{6})/i,
  TARIFA_MANUTENCAO: /MANUTENCAO DE TITULOS-COB(\d{6})/i,
  TARIFA_CESTA: /CESTA DE RELACIONAMENTO/i,
  OUTROS: /.*/
};

// =============================================================================
// FUNÇÕES DE CLASSIFICAÇÃO
// =============================================================================

/**
 * Classifica uma transação do OFX baseado no MEMO
 */
export function classifyTransaction(tx: OFXTransaction): ClassifiedTransaction {
  const memo = tx.description || tx.memo || '';

  // Tentar cada padrão em ordem de prioridade
  for (const [classification, pattern] of Object.entries(CLASSIFICATION_PATTERNS)) {
    if (classification === 'OUTROS') continue; // Verificar por último

    const match = memo.match(pattern);
    if (match) {
      const classified: ClassifiedTransaction = {
        ...tx,
        classification: classification as TransactionClassification
      };

      // Extrair dados específicos por tipo
      switch (classification) {
        case 'RECEBIMENTO_BOLETO':
        case 'TARIFA_LIQUIDACAO':
        case 'TARIFA_MANUTENCAO':
          classified.cobNumber = `COB${match[1]}`;
          break;

        case 'RECEBIMENTO_PIX':
        case 'PAGAMENTO_PIX':
          classified.cnpjCpf = match[1];
          classified.payerName = match[2]?.trim();
          break;

        case 'PAGAMENTO_BOLETO':
          classified.cnpjCpf = match[1];
          classified.payerName = match[2]?.trim();
          break;

        case 'DEBITO_CONVENIO':
          classified.payerName = match[1];
          classified.cnpjCpf = match[2];
          break;
      }

      return classified;
    }
  }

  // Fallback para OUTROS
  return {
    ...tx,
    classification: 'OUTROS'
  };
}

/**
 * Classifica todas as transações de um extrato
 */
export function classifyAllTransactions(transactions: OFXTransaction[]): ClassifiedTransaction[] {
  return transactions.map(classifyTransaction);
}

// =============================================================================
// PARSER DE CSV DE BOLETOS
// =============================================================================

/**
 * Mapeia colunas do CSV para campos do BoletoCSV
 * Colunas esperadas:
 * - Documento (COB number)
 * - N do boleto
 * - Pagador
 * - Data Vencimento
 * - Data Liquidação
 * - valor boleto
 * - valor recebido
 * - data do extrato
 */
export function parseBoletosCSV(content: string): {
  success: boolean;
  boletos: BoletoCSV[];
  error?: string;
} {
  const result = parseCSV(content, ';'); // Forçar ; como separador

  if (!result.success) {
    return { success: false, boletos: [], error: result.error };
  }

  const boletos: BoletoCSV[] = [];

  for (const row of result.rows) {
    // Mapear campos flexivelmente
    const documento = row['Documento'] || row['documento'] || row['COB'] || '';
    const nossoNumero = row['N do boleto'] || row['n_do_boleto'] || row['nosso_numero'] || '';
    const pagador = row['Pagador'] || row['pagador'] || row['cliente'] || '';
    const dataVencStr = row['Data Vencimento'] || row['data_vencimento'] || '';
    const dataLiqStr = row['Data Liquidação'] || row['data_liquidacao'] || row['Data Liquida\ufffdão'] || '';
    const valorBoletoStr = row['valor boleto'] || row['_valor_boleto'] || row['valor_boleto'] || '';
    const valorRecebidoStr = row['valor recebido'] || row['_valor_recebido'] || row['valor_recebido'] || '';
    const dataExtratoStr = row['data do extrato'] || row['data_do_extrato'] || '';

    const valorBoleto = parseBrazilianCurrency(valorBoletoStr);
    const valorRecebido = parseBrazilianCurrency(valorRecebidoStr);

    if (!documento || valorRecebido <= 0) {
      continue; // Pular linhas inválidas
    }

    boletos.push({
      documento: documento.toUpperCase().trim(),
      nossoNumero: nossoNumero.trim(),
      pagador: pagador.trim(),
      dataVencimento: parseDate(dataVencStr),
      dataLiquidacao: parseDate(dataLiqStr),
      valorBoleto,
      valorRecebido,
      dataExtrato: parseDate(dataExtratoStr),
      jurosMulta: valorRecebido - valorBoleto
    });
  }

  return { success: true, boletos };
}

/**
 * Agrupa boletos por COB number + data do extrato
 */
export function groupBoletosByCOB(boletos: BoletoCSV[]): BoletoGroup[] {
  const groups = new Map<string, BoletoGroup>();

  for (const boleto of boletos) {
    // Chave: COB + data do extrato (formatada)
    const dataStr = boleto.dataExtrato
      ? boleto.dataExtrato.toISOString().split('T')[0]
      : 'SEM_DATA';
    const key = `${boleto.documento}_${dataStr}`;

    if (!groups.has(key)) {
      groups.set(key, {
        cobNumber: boleto.documento,
        dataExtrato: boleto.dataExtrato,
        boletos: [],
        totalBoleto: 0,
        totalRecebido: 0,
        totalJurosMulta: 0,
        quantidadeBoletos: 0
      });
    }

    const group = groups.get(key)!;
    group.boletos.push(boleto);
    group.totalBoleto += boleto.valorBoleto;
    group.totalRecebido += boleto.valorRecebido;
    group.totalJurosMulta += boleto.jurosMulta;
    group.quantidadeBoletos++;
  }

  return Array.from(groups.values());
}

// =============================================================================
// LÓGICA DE CONCILIAÇÃO
// =============================================================================

/**
 * Encontra transações de tarifa associadas a um COB
 */
function findAssociatedFees(
  cobNumber: string,
  transactions: ClassifiedTransaction[]
): ClassifiedTransaction[] {
  return transactions.filter(tx =>
    (tx.classification === 'TARIFA_LIQUIDACAO' || tx.classification === 'TARIFA_MANUTENCAO') &&
    tx.cobNumber === cobNumber
  );
}

/**
 * Compara duas datas com tolerância de ±1 dia
 */
function datesMatch(date1: Date | null, date2: Date | null, toleranceDays = 1): boolean {
  if (!date1 || !date2) return false;

  const diff = Math.abs(date1.getTime() - date2.getTime());
  const dayMs = 24 * 60 * 60 * 1000;

  return diff <= toleranceDays * dayMs;
}

/**
 * Realiza a conciliação entre OFX e CSV
 */
export function reconcile(
  ofxStatement: OFXStatement,
  boletos: BoletoCSV[]
): ReconciliationSummary {
  // 1. Classificar transações do OFX
  const classifiedTx = classifyAllTransactions(ofxStatement.transactions);

  // 2. Agrupar boletos do CSV
  const boletoGroups = groupBoletosByCOB(boletos);

  // 3. Separar transações por tipo
  const recebimentosBoleto = classifiedTx.filter(tx => tx.classification === 'RECEBIMENTO_BOLETO');
  const transacoesPIX = classifiedTx.filter(tx => tx.classification === 'RECEBIMENTO_PIX');
  const tarifas = classifiedTx.filter(tx =>
    tx.classification === 'TARIFA_LIQUIDACAO' || tx.classification === 'TARIFA_MANUTENCAO'
  );
  const outrasTransacoes = classifiedTx.filter(tx =>
    tx.classification === 'OUTROS' ||
    tx.classification === 'PAGAMENTO_PIX' ||
    tx.classification === 'PAGAMENTO_BOLETO' ||
    tx.classification === 'DEBITO_CONVENIO' ||
    tx.classification === 'TARIFA_CESTA'
  );

  // 4. Conciliar cada grupo de boletos com transações do OFX
  const matches: ReconciliationMatch[] = [];
  const processedCOBs = new Set<string>();

  // 4a. Para cada crédito de boleto no OFX, buscar no CSV
  for (const txOFX of recebimentosBoleto) {
    const cobNumber = txOFX.cobNumber!;

    // Buscar grupos de boletos com mesmo COB
    const matchingGroups = boletoGroups.filter(g =>
      g.cobNumber === cobNumber &&
      datesMatch(g.dataExtrato, txOFX.date, 2) // Tolerância de 2 dias
    );

    // Encontrar tarifas associadas
    const feesTx = findAssociatedFees(cobNumber, tarifas);
    const totalFees = feesTx.reduce((sum, tx) => sum + tx.amount, 0);

    if (matchingGroups.length > 0) {
      // Encontrou correspondência
      const bestMatch = matchingGroups[0]; // Primeira correspondência
      const somaBoletos = bestMatch.totalRecebido;
      const diferenca = Math.abs(txOFX.amount - somaBoletos);

      // Considerar conciliado se diferença < R$ 0,10 (tolerância para arredondamentos)
      const status = diferenca < 0.10 ? 'CONCILIADO' : 'DIVERGENTE';

      matches.push({
        cobNumber,
        dataExtratoOFX: txOFX.date,
        valorCreditoOFX: txOFX.amount,
        somaBoletosCsv: somaBoletos,
        diferenca,
        tarifaAssociada: totalFees,
        liquidoReal: txOFX.amount - totalFees,
        status,
        boletos: bestMatch.boletos,
        transacaoOFX: txOFX,
        tarifasOFX: feesTx
      });

      processedCOBs.add(`${cobNumber}_${bestMatch.dataExtrato?.toISOString().split('T')[0]}`);
    } else {
      // Crédito no OFX sem boletos correspondentes no CSV
      matches.push({
        cobNumber,
        dataExtratoOFX: txOFX.date,
        valorCreditoOFX: txOFX.amount,
        somaBoletosCsv: 0,
        diferenca: txOFX.amount,
        tarifaAssociada: totalFees,
        liquidoReal: txOFX.amount - totalFees,
        status: 'SEM_BOLETO',
        boletos: [],
        transacaoOFX: txOFX,
        tarifasOFX: feesTx
      });
    }
  }

  // 4b. Boletos no CSV que não foram encontrados no OFX
  for (const group of boletoGroups) {
    const key = `${group.cobNumber}_${group.dataExtrato?.toISOString().split('T')[0]}`;

    if (!processedCOBs.has(key)) {
      // Verificar se a data está dentro do período do OFX
      const dataExtrato = group.dataExtrato;
      const dentroPeríodo = dataExtrato &&
        dataExtrato >= ofxStatement.startDate &&
        dataExtrato <= ofxStatement.endDate;

      if (dentroPeríodo) {
        matches.push({
          cobNumber: group.cobNumber,
          dataExtratoOFX: dataExtrato!,
          valorCreditoOFX: 0,
          somaBoletosCsv: group.totalRecebido,
          diferenca: group.totalRecebido,
          tarifaAssociada: 0,
          liquidoReal: 0,
          status: 'SEM_EXTRATO',
          boletos: group.boletos,
          transacaoOFX: undefined,
          tarifasOFX: []
        });
      }
      // Se fora do período, ignorar (será em outro extrato)
    }
  }

  // 5. Calcular totais
  const totalCreditosOFX = recebimentosBoleto.reduce((sum, tx) => sum + tx.amount, 0);
  const totalBoletosCSV = boletos.reduce((sum, b) => sum + b.valorRecebido, 0);
  const totalTarifas = tarifas.reduce((sum, tx) => sum + tx.amount, 0);

  const lotesConciliados = matches.filter(m => m.status === 'CONCILIADO').length;
  const lotesComDivergencia = matches.filter(m => m.status === 'DIVERGENTE').length;
  const boletosSemExtrato = matches.filter(m => m.status === 'SEM_EXTRATO').length;

  return {
    periodo: {
      inicio: ofxStatement.startDate,
      fim: ofxStatement.endDate
    },
    totalCreditosOFX,
    totalBoletosCSV,
    diferencaTotal: totalCreditosOFX - totalBoletosCSV,
    lotesConciliados,
    lotesComDivergencia,
    boletosSemExtrato,
    creditosPIX: transacoesPIX.length,
    totalTarifas,
    matches,
    transacoesPIX,
    transacoesNaoClassificadas: outrasTransacoes
  };
}

// =============================================================================
// FUNÇÃO PRINCIPAL DE CONCILIAÇÃO
// =============================================================================

/**
 * Executa a conciliação completa a partir dos arquivos
 */
export async function reconcileFromFiles(
  ofxContent: string,
  csvContent: string
): Promise<{
  success: boolean;
  summary?: ReconciliationSummary;
  error?: string;
}> {
  try {
    // 1. Parse do OFX
    const ofxResult = await parseOFX(ofxContent);
    if (!ofxResult.success || !ofxResult.data) {
      return { success: false, error: `Erro ao processar OFX: ${ofxResult.error}` };
    }

    // 2. Parse do CSV
    const csvResult = parseBoletosCSV(csvContent);
    if (!csvResult.success) {
      return { success: false, error: `Erro ao processar CSV: ${csvResult.error}` };
    }

    // 3. Executar conciliação
    const summary = reconcile(ofxResult.data, csvResult.boletos);

    return { success: true, summary };

  } catch (error: any) {
    return { success: false, error: error.message || 'Erro na conciliação' };
  }
}

// =============================================================================
// FORMATADORES PARA RELATÓRIO
// =============================================================================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

/**
 * Gera relatório de conciliação em formato texto
 * Útil para logs e debugging
 */
export function generateTextReport(summary: ReconciliationSummary): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════════════════');
  lines.push(`RELATÓRIO DE CONCILIAÇÃO BANCÁRIA — ${formatDate(summary.periodo.inicio)} a ${formatDate(summary.periodo.fim)}`);
  lines.push('═══════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('RESUMO:');
  lines.push(`  Total de créditos OFX (cobrança): ${formatCurrency(summary.totalCreditosOFX)}`);
  lines.push(`  Total de boletos CSV (recebido):  ${formatCurrency(summary.totalBoletosCSV)}`);
  lines.push(`  Diferença total:                  ${formatCurrency(summary.diferencaTotal)}`);
  lines.push('');
  lines.push(`  Lotes conciliados:      ${summary.lotesConciliados}`);
  lines.push(`  Lotes com divergência:  ${summary.lotesComDivergencia}`);
  lines.push(`  Boletos sem extrato:    ${summary.boletosSemExtrato}`);
  lines.push(`  Créditos PIX:           ${summary.creditosPIX}`);
  lines.push(`  Total de tarifas:       ${formatCurrency(summary.totalTarifas)}`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────────');
  lines.push('DETALHAMENTO POR LOTE:');
  lines.push('───────────────────────────────────────────────────────────────────────────');

  for (const match of summary.matches) {
    lines.push('');
    lines.push(`LOTE: ${match.cobNumber} | Data Extrato OFX: ${formatDate(match.dataExtratoOFX)}`);
    lines.push(`Status: ${match.status}`);
    lines.push(`  Crédito no extrato:     ${formatCurrency(match.valorCreditoOFX)}`);
    lines.push(`  Soma boletos no CSV:    ${formatCurrency(match.somaBoletosCsv)}`);
    lines.push(`  DIFERENÇA:              ${formatCurrency(match.diferenca)}`);
    lines.push(`  Tarifa associada:       ${formatCurrency(match.tarifaAssociada)}`);
    lines.push(`  Líquido real:           ${formatCurrency(match.liquidoReal)}`);

    if (match.boletos.length > 0) {
      lines.push(`  Boletos (${match.boletos.length}):`);
      for (const boleto of match.boletos) {
        lines.push(`    ${boleto.nossoNumero}  ${boleto.pagador.substring(0, 40).padEnd(40)}  ${formatCurrency(boleto.valorRecebido)}`);
      }
    }
  }

  if (summary.transacoesPIX.length > 0) {
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────────────────');
    lines.push(`RECEBIMENTOS VIA PIX (${summary.transacoesPIX.length}):`);
    lines.push('───────────────────────────────────────────────────────────────────────────');
    for (const pix of summary.transacoesPIX) {
      lines.push(`  ${formatDate(pix.date)}  ${pix.payerName?.substring(0, 40).padEnd(40)}  ${formatCurrency(pix.amount)}`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
