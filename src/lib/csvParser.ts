/**
 * CSV Parser com auto-detecção de separador
 *
 * Suporta:
 * - Separador automático (vírgula, ponto-e-vírgula, tab)
 * - Valores com aspas
 * - Quebras de linha dentro de campos
 * - Encoding UTF-8 e ISO-8859-1
 */

export interface CSVParseResult {
  success: boolean;
  headers: string[];
  rows: Record<string, string>[];
  separator: string;
  totalRows: number;
  error?: string;
}

/**
 * Detecta o separador mais provável do CSV
 */
export function detectSeparator(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] || '';

  // Contar ocorrências de cada separador
  const separators = [';', ',', '\t', '|'];
  const counts: Record<string, number> = {};

  separators.forEach(sep => {
    counts[sep] = (firstLine.match(new RegExp(`\\${sep}`, 'g')) || []).length;
  });

  // Retornar o separador com mais ocorrências
  // Priorizar ponto-e-vírgula se empatar (formato brasileiro)
  let maxCount = 0;
  let detectedSep = ';';

  separators.forEach(sep => {
    if (counts[sep] > maxCount) {
      maxCount = counts[sep];
      detectedSep = sep;
    } else if (counts[sep] === maxCount && sep === ';') {
      // Priorizar ; em caso de empate
      detectedSep = sep;
    }
  });

  return detectedSep;
}

/**
 * Converte valor monetário brasileiro para número
 * Suporta: "1.234,56" ou "1234,56" ou "R$ 1.234,56"
 */
export function parseBrazilianCurrency(value: string): number {
  if (!value || value.trim() === '') return 0;

  // Remover R$, espaços e outros caracteres
  let cleaned = value
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .trim();

  // Se tem vírgula como decimal e ponto como milhar (formato BR)
  if (cleaned.includes(',')) {
    // Remover pontos de milhar e trocar vírgula por ponto
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Converte data em vários formatos para Date
 */
export function parseDate(value: string): Date | null {
  if (!value || value.trim() === '') return null;

  const cleaned = value.trim();

  // DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
  }

  // YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  // Tentar parse direto
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Normaliza nome de coluna para chave
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '_')      // Substitui caracteres especiais por _
    .replace(/_+/g, '_')              // Remove _ duplicados
    .replace(/^_|_$/g, '');           // Remove _ no início e fim
}

/**
 * Parse de linha CSV respeitando aspas
 */
function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Aspa escapada
        current += '"';
        i++;
      } else {
        // Toggle estado de aspas
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse completo de CSV
 */
export function parseCSV(content: string, forceSeparator?: string): CSVParseResult {
  try {
    // Normalizar quebras de linha
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Detectar ou usar separador forçado
    const separator = forceSeparator || detectSeparator(normalized);

    // Separar linhas (respeitando aspas)
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (const char of normalized) {
      if (char === '"') {
        inQuotes = !inQuotes;
      }

      if (char === '\n' && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    if (lines.length === 0) {
      return {
        success: false,
        headers: [],
        rows: [],
        separator,
        totalRows: 0,
        error: 'Arquivo vazio'
      };
    }

    // Primeira linha = headers
    const rawHeaders = parseCSVLine(lines[0], separator);
    const headers = rawHeaders.map(h => normalizeHeader(h));

    // Criar mapa de headers originais para normalizados
    const headerMap: Record<string, string> = {};
    rawHeaders.forEach((raw, i) => {
      headerMap[raw] = headers[i];
    });

    // Parse das linhas de dados
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], separator);

      if (values.length === 0 || (values.length === 1 && values[0] === '')) {
        continue; // Linha vazia
      }

      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      // Também adicionar com headers originais para compatibilidade
      rawHeaders.forEach((rawHeader, idx) => {
        row[rawHeader] = values[idx] || '';
      });

      rows.push(row);
    }

    return {
      success: true,
      headers,
      rows,
      separator,
      totalRows: rows.length
    };

  } catch (error: any) {
    return {
      success: false,
      headers: [],
      rows: [],
      separator: ';',
      totalRows: 0,
      error: error.message || 'Erro ao processar CSV'
    };
  }
}

/**
 * Mapeia campos do CSV para campos esperados
 */
export interface FieldMapping {
  valor?: string;
  data?: string;
  descricao?: string;
  tipo?: string;
  cliente?: string;
  cnpj?: string;
  nosso_numero?: string;
  [key: string]: string | undefined;
}

export function autoMapFields(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};

  const fieldPatterns: Record<keyof FieldMapping, RegExp[]> = {
    valor: [/valor/i, /value/i, /amount/i, /vlr/i, /total/i],
    data: [/data/i, /date/i, /vencimento/i, /due/i, /dt/i, /liquidacao/i],
    descricao: [/descri/i, /description/i, /memo/i, /historico/i, /obs/i],
    tipo: [/tipo/i, /type/i, /natureza/i, /movimento/i],
    cliente: [/cliente/i, /client/i, /pagador/i, /nome/i, /name/i, /razao/i, /sacado/i],
    cnpj: [/cnpj/i, /cpf/i, /documento/i, /doc/i],
    nosso_numero: [/nosso/i, /numero/i, /boleto/i, /titulo/i]
  };

  headers.forEach(header => {
    for (const [field, patterns] of Object.entries(fieldPatterns)) {
      if (patterns.some(pattern => pattern.test(header))) {
        if (!mapping[field as keyof FieldMapping]) {
          mapping[field as keyof FieldMapping] = header;
        }
      }
    }
  });

  return mapping;
}

/**
 * Processa arquivo CSV de boletos liquidados
 */
export interface BoletoLiquidado {
  nossoNumero?: string;
  valorPago: number;
  dataLiquidacao: Date | null;
  cliente?: string;
  cnpj?: string;
  descricao?: string;
  raw: Record<string, string>;
}

export function parseBoletosCSV(content: string): {
  success: boolean;
  boletos: BoletoLiquidado[];
  error?: string;
} {
  const parseResult = parseCSV(content);

  if (!parseResult.success) {
    return {
      success: false,
      boletos: [],
      error: parseResult.error
    };
  }

  const mapping = autoMapFields(parseResult.headers);

  const boletos: BoletoLiquidado[] = parseResult.rows.map(row => {
    const valorStr = mapping.valor ? row[mapping.valor] : '';
    const dataStr = mapping.data ? row[mapping.data] : '';

    return {
      nossoNumero: mapping.nosso_numero ? row[mapping.nosso_numero] : undefined,
      valorPago: parseBrazilianCurrency(valorStr),
      dataLiquidacao: parseDate(dataStr),
      cliente: mapping.cliente ? row[mapping.cliente] : undefined,
      cnpj: mapping.cnpj ? row[mapping.cnpj] : undefined,
      descricao: mapping.descricao ? row[mapping.descricao] : undefined,
      raw: row
    };
  }).filter(b => b.valorPago > 0);

  return {
    success: true,
    boletos
  };
}

/**
 * Processa arquivo CSV de extrato bancário
 */
export interface TransacaoBancaria {
  data: Date | null;
  descricao: string;
  valor: number;
  tipo: 'credit' | 'debit';
  raw: Record<string, string>;
}

export function parseExtratoBancarioCSV(content: string): {
  success: boolean;
  transacoes: TransacaoBancaria[];
  error?: string;
} {
  const parseResult = parseCSV(content);

  if (!parseResult.success) {
    return {
      success: false,
      transacoes: [],
      error: parseResult.error
    };
  }

  const mapping = autoMapFields(parseResult.headers);

  const transacoes: TransacaoBancaria[] = parseResult.rows.map(row => {
    const valorStr = mapping.valor ? row[mapping.valor] : '';
    const dataStr = mapping.data ? row[mapping.data] : '';
    const tipoStr = mapping.tipo ? row[mapping.tipo]?.toLowerCase() : '';

    const valor = parseBrazilianCurrency(valorStr);

    // Determinar tipo baseado no valor ou campo tipo
    let tipo: 'credit' | 'debit' = 'debit';

    if (tipoStr.includes('credit') || tipoStr.includes('entrada') || tipoStr.includes('c')) {
      tipo = 'credit';
    } else if (valor > 0 && !tipoStr.includes('debit') && !tipoStr.includes('saida') && !tipoStr.includes('d')) {
      // Se valor positivo e não especificado como débito, assumir crédito
      tipo = 'credit';
    }

    return {
      data: parseDate(dataStr),
      descricao: mapping.descricao ? row[mapping.descricao] : '',
      valor: Math.abs(valor),
      tipo,
      raw: row
    };
  }).filter(t => t.valor > 0);

  return {
    success: true,
    transacoes
  };
}
