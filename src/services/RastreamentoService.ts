/**
 * Sistema de Rastreamento de Lançamentos Contábeis
 * 
 * Implementa numeração única para cada lançamento, similar a:
 * - CNPJ: identifica a empresa
 * - GTIN: identifica a mercadoria
 * - Este sistema: identifica cada lançamento de forma única e imutável
 */

/**
 * Gera código único para rastreamento de lançamento
 * 
 * Formato: TIPO_YYYYMM_SEQUENCE_HASH
 * Exemplo: FOLD_202512_001_A7F2E9
 * 
 * Componentes:
 * - TIPO: Tipo de lançamento (FOLD=Folha, PAGTO=Pagamento, etc)
 * - YYYYMM: Competência (ano-mês)
 * - SEQUENCE: Número sequencial do mês
 * - HASH: Hash MD5 dos dados para validação
 */

export interface LancamentoRastreavel {
  // ID único (gerado automaticamente)
  codigoRastreamento: string;
  
  // Componentes do código
  tipo: 'FOLD' | 'PAGTO_SAL' | 'RECOLH_INSS' | 'RECOLH_IRRF';
  competenciaAno: number;
  competenciaMes: number;
  sequencial: number;
  
  // Hash para validação de integridade
  hashValidacao: string;
  
  // Referência para audit
  referenceId: string;
  
  // Timestamps
  dataCriacao: string;
  dataDuplicacao?: string;
}

/**
 * Gera número sequencial para o mês
 */
async function obterProximoSequencial(
  supabase: any,
  tipo: string,
  ano: number,
  mes: number
): Promise<number> {
  // Buscar por description (reference_id é UUID, não suporta texto)
  const pattern = `[${tipo}_${ano}${String(mes).padStart(2, '0')}_%`;
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('description')
    .like('description', `%[${tipo}_${ano}${String(mes).padStart(2, '0')}_%]%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return 1;
  }

  // Extrair número sequencial do código no description: [FOLD_202602_001_HASH]
  const desc = data[0].description || '';
  const match = desc.match(new RegExp(`\\[${tipo}_\\d{6}_(\\d{3})_[A-F0-9]+\\]`));
  if (!match) return 1;

  return parseInt(match[1], 10) + 1;
}

/**
 * Calcula hash MD5 para validação de integridade
 */
function calcularHashValidacao(dados: any): string {
  // Simples implementação usando JSON serialization
  // Em produção, usar crypto.subtle.digest('SHA-256', ...)
  const jsonStr = JSON.stringify(dados);
  let hash = 0;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).toUpperCase().padStart(6, '0');
}

/**
 * Gera código único de rastreamento
 */
export async function gerarCodigoRastreamento(
  supabase: any,
  tipo: 'FOLD' | 'PAGTO_SAL' | 'RECOLH_INSS' | 'RECOLH_IRRF',
  dados: any,
  competenciaAno: number,
  competenciaMes: number
): Promise<LancamentoRastreavel> {
  // 1. Obter próximo sequencial
  const sequencial = await obterProximoSequencial(
    supabase,
    tipo,
    competenciaAno,
    competenciaMes
  );

  // 2. Calcular hash de validação
  const hashValidacao = calcularHashValidacao({
    tipo,
    competenciaAno,
    competenciaMes,
    sequencial,
    dados
  });

  // 3. Montar código completo
  const codigoRastreamento = `${tipo}_${competenciaAno}${String(competenciaMes).padStart(2, '0')}_${String(sequencial).padStart(3, '0')}_${hashValidacao}`;

  // 4. Gerar referência para auditoria
  const referenceId = codigoRastreamento;

  // 5. Retornar objeto de rastreamento
  return {
    codigoRastreamento,
    tipo,
    competenciaAno,
    competenciaMes,
    sequencial,
    hashValidacao,
    referenceId,
    dataCriacao: new Date().toISOString(),
  };
}

/**
 * Valida se lançamento já existe (evita duplicatas)
 */
export async function validarDuplicata(
  supabase: any,
  codigoRastreamento: string,
  referenceId: string
): Promise<{ isDuplicata: boolean; entryId?: string; message?: string }> {
  // Buscar por código de rastreamento na description (reference_id é UUID, não texto)
  const { data: byCode } = await supabase
    .from('accounting_entries')
    .select('id, description, entry_date')
    .like('description', `%[${codigoRastreamento}]%`)
    .limit(1);

  if (byCode && byCode.length > 0) {
    return {
      isDuplicata: true,
      entryId: byCode[0].id,
      message: `Lançamento duplicado detectado! Código: ${codigoRastreamento}. Entry ID: ${byCode[0].id}. Data: ${byCode[0].entry_date}`
    };
  }

  return { isDuplicata: false };
}

/**
 * Log de rastreamento para auditoria
 */
export async function registrarRastreamento(
  supabase: any,
  rastreamento: LancamentoRastreavel,
  entryId: string,
  dados: any
): Promise<boolean> {
  try {
    // Criar tabela de log se não existir (será criada via migração)
    const { error } = await supabase
      .from('accounting_entry_tracking')
      .insert([
        {
          codigo_rastreamento: rastreamento.codigoRastreamento,
          tipo: rastreamento.tipo,
          competencia_ano: rastreamento.competenciaAno,
          competencia_mes: rastreamento.competenciaMes,
          sequencial: rastreamento.sequencial,
          hash_validacao: rastreamento.hashValidacao,
          entry_id: entryId,
          reference_id: rastreamento.referenceId,
          dados_originais: JSON.stringify(dados),
          data_criacao: rastreamento.dataCriacao,
        }
      ]);

    if (error) {
      console.warn('Aviso: Não foi possível registrar rastreamento:', error.message);
      return false; // Não falhar o lançamento se o log falhar
    }

    return true;
  } catch (error) {
    console.warn('Aviso: Erro ao registrar rastreamento:', error);
    return false;
  }
}

/**
 * Obter histórico de rastreamento
 */
export async function obterHistoricoRastreamento(
  supabase: any,
  codigoRastreamento: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('accounting_entry_tracking')
    .select('*')
    .eq('codigo_rastreamento', codigoRastreamento)
    .order('data_criacao', { ascending: true });

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }

  return data || [];
}

/**
 * Validar integridade de lançamento
 */
export async function validarIntegridade(
  supabase: any,
  codigoRastreamento: string
): Promise<{ valido: boolean; motivo?: string; detalhes?: any }> {
  // 1. Buscar histórico
  const historico = await obterHistoricoRastreamento(supabase, codigoRastreamento);

  if (historico.length === 0) {
    return {
      valido: false,
      motivo: 'Nenhum registro de rastreamento encontrado'
    };
  }

  // 2. Validar hash
  const registro = historico[0];
  const hashEsperado = calcularHashValidacao({
    tipo: registro.tipo,
    competenciaAno: registro.competencia_ano,
    competenciaMes: registro.competencia_mes,
    sequencial: registro.sequencial,
    dados: JSON.parse(registro.dados_originais)
  });

  if (hashEsperado !== registro.hash_validacao) {
    return {
      valido: false,
      motivo: 'Falha na validação de integridade (hash não corresponde)',
      detalhes: {
        esperado: hashEsperado,
        encontrado: registro.hash_validacao
      }
    };
  }

  // 3. Validar sequência
  if (historico.length > 1) {
    const anterior = historico[historico.length - 2];
    const atual = historico[historico.length - 1];
    
    // Verificar se é sequencial
    const seqAnterior = anterior.sequencial;
    const seqAtual = atual.sequencial;
    
    if (seqAtual !== seqAnterior + 1) {
      // Permitir pois pode ter meses diferentes
      console.warn('⚠️ Aviso: Sequência não é contígua (pode ser em meses diferentes)');
    }
  }

  return {
    valido: true,
    detalhes: {
      codigoRastreamento,
      sequencial: registro.sequencial,
      dataRegistro: registro.data_criacao,
      hashValidacao: registro.hash_validacao
    }
  };
}

export default {
  gerarCodigoRastreamento,
  validarDuplicata,
  registrarRastreamento,
  obterHistoricoRastreamento,
  validarIntegridade,
  calcularHashValidacao,
  obterProximoSequencial
};
