/**
 * Parser para arquivo de cobrança (clientes boletos jan.csv)
 * Formato: Documento;N do boleto;Pagador;Data Vencimento;Data Liquidação;valor boleto;valor recebido;data do extrato
 */

export interface CobrancaRecord {
  documento: string; // COB000005
  numeroboleto: string; // 24/204549-0
  pagador: string; // PET SHOP E COMPANHIA LTDA
  dataVencimento: Date;
  dataLiquidacao: Date;
  valorBoleto: number;
  valorRecebido: number;
  dataExtrato: Date;
}

export interface CobrancaGroup {
  documento: string; // COB000005
  dataLiquidacao: Date;
  dataExtrato: Date;
  totalRecebido: number;
  clientes: CobrancaRecord[];
}

/**
 * Parse CSV file com separador ponto-vírgula
 * Suporta formatos com 8 ou 9 colunas
 */
export function parseCobrancaCSV(csvContent: string): CobrancaRecord[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Arquivo vazio ou inválido');
  }

  const records: CobrancaRecord[] = [];

  // Detectar cabeçalho para mapeamento de colunas
  const header = lines[0].toLowerCase();
  const hasCartColumn = header.includes('cart') || header.startsWith('cart;');
  
  // Skip header (linha 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';').map(p => p.trim());
    
    // Validar número mínimo de colunas
    // Formato antigo: Documento;N do boleto;Pagador;... (8 colunas)
    // Formato novo: Cart;N Doc;Nosso N;Pagador;... (9 colunas)
    if (parts.length < 8) continue;

    let documento, numeroboleto, pagador, dataVencStr, dataLiqStr, valorBolStr, valorRecStr, dataExtratoStr;

    if (hasCartColumn && parts.length >= 9) {
      // Formato Novo (9 colunas - Cart;N Doc;Nosso N;Pagador;...)
      documento = parts[0]; // Cart (COB...)
      // parts[1] is N Doc
      numeroboleto = parts[2]; // Nosso N
      pagador = parts[3];
      dataVencStr = parts[4];
      dataLiqStr = parts[5];
      valorBolStr = parts[6];
      valorRecStr = parts[7];
      dataExtratoStr = parts[8];
    } else {
      // Formato Antigo (8 colunas - Documento;N Boleto;Pagador;...)
      documento = parts[0];
      numeroboleto = parts[1];
      pagador = parts[2];
      dataVencStr = parts[3];
      dataLiqStr = parts[4];
      valorBolStr = parts[5];
      valorRecStr = parts[6];
      dataExtratoStr = parts[7];
    }

    records.push({
      documento,
      numeroboleto,
      pagador,
      dataVencimento: parseData(dataVencStr),
      dataLiquidacao: parseData(dataLiqStr),
      valorBoleto: parseValor(valorBolStr),
      valorRecebido: parseValor(valorRecStr),
      dataExtrato: parseData(dataExtratoStr),
    });
  }

  return records;
}

/**
 * Função auxiliar para parse de datas DD/MM/YYYY
 */
function parseData(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    // Meses são 0-indexed em JS
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date();
}

/**
 * Função auxiliar para parse de valores (R$ 1.000,00 -> 1000.00)
 */
function parseValor(valorStr: string): number {
  if (!valorStr) return 0;
  return parseFloat(
    valorStr
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  );
}


/**
 * Formata data para chave de agrupamento
 */
function formatData(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Agrupa registros por documento + data de extrato
 * Isso é necessário porque um mesmo COB pode ter múltiplas liquidações em datas diferentes
 * Ex: COB000005 pode ter liquidação de R$ 5.913,78 em 03/01 e R$ 1.330,58 em 09/01
 * Cada uma corresponde a uma transação bancária diferente
 */
export function groupByDocumento(records: CobrancaRecord[]): Map<string, CobrancaGroup> {
  const groups = new Map<string, CobrancaGroup>();

  for (const record of records) {
    // Chave composta: documento + data de extrato
    const dataKey = formatData(record.dataExtrato);
    const key = `${record.documento}_${dataKey}`;

    if (!groups.has(key)) {
      groups.set(key, {
        documento: record.documento,
        dataLiquidacao: record.dataLiquidacao,
        dataExtrato: record.dataExtrato,
        totalRecebido: 0,
        clientes: [],
      });
    }

    const group = groups.get(key)!;
    group.clientes.push(record);
    group.totalRecebido += record.valorRecebido;
  }

  // Arredondar totais para 2 casas decimais para evitar problemas de precisão de ponto flutuante
  // Ex: 17076.850000000002 -> 17076.85
  for (const group of groups.values()) {
    group.totalRecebido = Math.round(group.totalRecebido * 100) / 100;
  }

  return groups;
}

/**
 * Agrupa por data de extrato (para conciliar com movimentações do banco)
 */
export function groupByDataExtrato(records: CobrancaRecord[]): Map<string, CobrancaGroup[]> {
  const groups = new Map<string, CobrancaGroup[]>();

  const byDoc = groupByDocumento(records);

  for (const [doc, group] of byDoc) {
    const dataKey = formatData(group.dataExtrato);
    if (!groups.has(dataKey)) {
      groups.set(dataKey, []);
    }
    groups.get(dataKey)!.push(group);
  }

  return groups;
}


