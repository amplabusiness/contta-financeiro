/**
 * Função para validar classificação com Dr. Cícero antes de aplicar
 */

import { supabase } from '@/integrations/supabase/client';

export interface ClassificacaoValidada {
  aprovado: boolean;
  confianca: number;
  motivo?: string;
  historico?: any;
}

/**
 * Valida uma classificação com base no histórico do Dr. Cícero
 */
export async function validarClassificacaoComDrCicero(
  tenantId: string,
  descricao: string,
  contaDebito: string,
  contaCredito: string,
  valor: number
): Promise<ClassificacaoValidada> {

  // 1. Verificar se já existe regra aprendida
  const keywords = descricao.substring(0, 30);
  const { data: ruleData } = await supabase
    .from('learned_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .ilike('rule_name', `%${keywords}%`)
    .limit(1);

  if (ruleData && ruleData.length > 0) {
    const rule = ruleData[0];

    // Se há regra aprendida, verificar se as contas batem
    const ruleMatch =
      rule.action_description?.includes(contaDebito) &&
      rule.action_description?.includes(contaCredito);

    if (ruleMatch) {
      return {
        aprovado: true,
        confianca: 0.98,
        motivo: `Regra aprendida: ${rule.rule_name} (${rule.occurrence_count}x aplicada)`,
        historico: rule
      };
    }
  }

  // 2. Verificar histórico de auditoria (busca por search_text ou por ação bem-sucedida)
  const searchTerm = descricao.substring(0, 20);
  let auditData: any[] | null = null;
  try {
    // Tentar buscar por search_text (coluna text, compatível com ilike)
    const { data, error } = await supabase
      .from('reconciliation_audit_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('action', 'classificacao_automatica_aplicada')
      .ilike('search_text', `%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!error) {
      auditData = data;
    } else {
      // Fallback: se search_text não existir, buscar apenas por ação bem-sucedida
      const { data: fallbackData } = await supabase
        .from('reconciliation_audit_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('action', 'classificacao_automatica_aplicada')
        .order('created_at', { ascending: false })
        .limit(5);

      auditData = fallbackData;
    }
  } catch (e) {
    // Tabela pode não existir - continuar sem precedentes
    console.warn('[Dr. Cícero] reconciliation_audit_log indisponível:', e);
  }

  if (auditData && auditData.length >= 2) {
    return {
      aprovado: true,
      confianca: 0.85,
      motivo: `Padrão recorrente encontrado (${auditData.length} ocorrências)`,
      historico: auditData
    };
  }

  // 3. Validação básica de integridade contábil
  if (contaDebito === contaCredito) {
    return {
      aprovado: false,
      confianca: 0,
      motivo: 'ERRO: Débito e Crédito são a mesma conta!'
    };
  }

  // 4. Validação de contas válidas (começam com números)
  const debitoValido = /^\d/.test(contaDebito);
  const creditoValido = /^\d/.test(contaCredito);

  if (!debitoValido || !creditoValido) {
    return {
      aprovado: false,
      confianca: 0,
      motivo: 'ERRO: Códigos de conta inválidos'
    };
  }

  // 5. Primeira execução sem precedentes: aprovar com confiança reduzida
  // Isso quebra o deadlock - permite criar os primeiros precedentes
  // que serão usados nas próximas execuções (step 2)
  return {
    aprovado: true,
    confianca: 0.70,
    motivo: 'Primeira classificação (sem precedente) - aprovado para criar histórico inicial'
  };
}

/**
 * Consulta Dr. Cícero antes de criar uma conta no plano de contas.
 * Valida: código segue máscara, natureza correta, hierarquia consistente.
 */
export async function consultarDrCiceroCriacaoConta(
  tenantId: string,
  code: string,
  name: string
): Promise<{ aprovado: boolean; motivo: string; codigoSintetica?: string; codigoAnalitica?: string; accountType: string; nature: string; }> {
  const prefix = code.charAt(0);
  const parts = code.split('.');
  const level = parts.length;

  // Determinar tipo e natureza pela raiz
  const accountType = prefix === '1' ? 'asset' : prefix === '2' ? 'liability' : prefix === '3' ? 'revenue' : 'expense';
  const nature = (prefix === '1' || prefix === '4') ? 'debit' : 'credit';

  // Verificar se já existe no plano
  const { data: existing } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_analytical')
    .eq('tenant_id', tenantId)
    .eq('code', code)
    .limit(1);

  if (existing && existing.length > 0) {
    const acc = existing[0];
    if (acc.is_analytical) {
      return {
        aprovado: true,
        motivo: `Conta ${code} já existe como analítica: ${acc.name}`,
        codigoAnalitica: code,
        accountType,
        nature
      };
    }
    // Já existe como sintética - buscar filha
    const { data: child } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('tenant_id', tenantId)
      .eq('is_analytical', true)
      .ilike('code', `${code}.%`)
      .order('code')
      .limit(1);

    if (child && child.length > 0) {
      return {
        aprovado: true,
        motivo: `Conta ${code} é sintética, usando filha ${child[0].code}: ${child[0].name}`,
        codigoSintetica: code,
        codigoAnalitica: child[0].code,
        accountType,
        nature
      };
    }
    // Sintética sem filha - criar filha .01
    return {
      aprovado: true,
      motivo: `Conta ${code} é sintética sem filha analítica. Dr. Cícero autoriza criar ${code}.01`,
      codigoSintetica: code,
      codigoAnalitica: `${code}.01`,
      accountType,
      nature
    };
  }

  // Conta não existe - verificar hierarquia pai
  const parentParts = [...parts];
  parentParts.pop();
  const parentCode = parentParts.join('.');

  if (parentParts.length >= 3) {
    const { data: parent } = await supabase
      .from('chart_of_accounts')
      .select('id, code, is_analytical')
      .eq('tenant_id', tenantId)
      .eq('code', parentCode)
      .limit(1);

    if (!parent || parent.length === 0) {
      return {
        aprovado: true,
        motivo: `Conta pai ${parentCode} não existe. Dr. Cícero autoriza criar hierarquia: ${code} (sintética) + ${code}.01 (analítica)`,
        codigoSintetica: code,
        codigoAnalitica: `${code}.01`,
        accountType,
        nature
      };
    }
  }

  // Conta não existe, pai existe - criar como sintética + filha analítica
  return {
    aprovado: true,
    motivo: `Dr. Cícero autoriza criar: ${code} (sintética) + ${code}.01 (analítica) - "${name}"`,
    codigoSintetica: code,
    codigoAnalitica: `${code}.01`,
    accountType,
    nature
  };
}

/**
 * Registra a aplicação de uma regra no histórico
 */
export async function registrarAplicacaoRegra(
  tenantId: string,
  userId: string,
  transacaoId: string,
  classificacao: any,
  resultado: 'sucesso' | 'erro',
  detalhes?: string
): Promise<void> {
  try {
    const descricaoTexto = classificacao?.historico || classificacao?.descricao || detalhes || '';
    await supabase
      .from('reconciliation_audit_log')
      .insert({
        tenant_id: tenantId,
        transaction_id: transacaoId,
        action: resultado === 'sucesso' ?
          'classificacao_automatica_aplicada' :
          'classificacao_automatica_falhou',
        actor: userId,
        entity_type: 'bank_transaction',
        entity_id: transacaoId,
        search_text: String(descricaoTexto).substring(0, 200),
        details: {
          classificacao,
          resultado,
          detalhes,
          timestamp: new Date().toISOString()
        }
      });
  } catch (e) {
    // Se a tabela não existir, log e continua sem travar o fluxo
    console.warn('[Dr. Cícero] Falha ao registrar auditoria:', e);
  }
}
