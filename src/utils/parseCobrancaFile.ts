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
 */
export function parseCobrancaCSV(csvContent: string): CobrancaRecord[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Arquivo vazio ou inválido');
  }

  const records: CobrancaRecord[] = [];

  // Skip header (linha 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';').map(p => p.trim());
    if (parts.length < 8) continue;

    const [documento, numeroboleto, pagador, dataVencStr, dataLiqStr, valorBolStr, valorRecStr, dataExtratoStr] = parts;

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
 * Agrupa registros por documento (COB000005, COB000007, etc)
 * Isso permite ver que COB000005 tem múltiplos clientes somando R$ 5.913,78
 */
export function groupByDocumento(records: CobrancaRecord[]): Map<string, CobrancaGroup> {
  const groups = new Map<string, CobrancaGroup>();

  for (const record of records) {
    const key = record.documento;
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

/**
 * Utilities para parse de data (format: DD/MM/YYYY)
 */
function parseData(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function formatData(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse valor (pode vir como "1.412,00" ou "1412,00")
 */
function parseValor(valorStr: string): number {
  // Remove pontos de milhares e converte vírgula em ponto
  const cleaned = valorStr
    .replace('.', '') // Remove ponto de separador de milhares
    .replace(',', '.'); // Converte vírgula em ponto decimal
  return parseFloat(cleaned);
}
