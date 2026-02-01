/**
 * ============================================================================
 * DR. CÍCERO INTELLIGENCE SERVICE
 * ============================================================================
 * Sistema de Aprendizado e Consulta Histórica
 * Data: 01/02/2026
 * ============================================================================
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TIPOS
// ============================================================================

export interface HistoricalContext {
  hasHistory: boolean;
  similarCases: SimilarCase[];
  recommendedAction: string;
  confidence: 'high' | 'medium' | 'low';
  precedents: Precedent[];
}

interface SimilarCase {
  date: string;
  description: string;
  decision: string;
  outcome: string;
}

interface Precedent {
  rule_id: string;
  rule_name: string;
  occurrences: number;
  lastOccurrence: string;
  action: string;
}

export interface DivergenceAnalysis {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  historicalContext: HistoricalContext;
  suggestedResolution: string;
}

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export class DrCiceroIntelligenceService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Consulta histórico para uma situação específica
   */
  async queryHistory(
    situationType: string,
    keywords: string[]
  ): Promise<HistoricalContext> {
    // 1. Buscar regras aprendidas relacionadas
    const { data: rules } = await supabase
      .from('learned_rules')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('is_active', true)
      .or(`category.eq.${situationType},rule_name.ilike.%${keywords.join('%')}%`);

    // 2. Buscar casos no audit log
    const { data: auditCases } = await supabase
      .from('reconciliation_audit_log')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    // 3. Buscar documentos relacionados
    const { data: docs } = await supabase
      .from('document_catalog')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .contains('tags', keywords.slice(0, 3))
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Montar contexto
    const precedents: Precedent[] = (rules || []).map(r => ({
      rule_id: r.rule_id,
      rule_name: r.rule_name,
      occurrences: r.occurrence_count,
      lastOccurrence: r.last_occurrence,
      action: r.action_description
    }));

    const similarCases: SimilarCase[] = (auditCases || [])
      .slice(0, 5)
      .map(c => ({
        date: c.created_at,
        description: `${c.action} por ${c.actor}`,
        decision: c.action,
        outcome: 'Registrado com sucesso'
      }));

    const hasHistory = precedents.length > 0 || similarCases.length > 0;

    return {
      hasHistory,
      similarCases,
      precedents,
      recommendedAction: this.deriveRecommendation(precedents, similarCases),
      confidence: hasHistory ? (precedents.length >= 2 ? 'high' : 'medium') : 'low'
    };
  }

  /**
   * Analisa uma divergência com base histórica
   */
  async analyzeDivergence(
    divergenceType: string,
    details: Record<string, any>
  ): Promise<DivergenceAnalysis> {
    // 1. Mapear tipo para keywords
    const keywords = this.getKeywordsForDivergence(divergenceType);

    // 2. Consultar histórico
    const historicalContext = await this.queryHistory(divergenceType, keywords);

    // 3. Buscar regra específica
    const { data: rule } = await supabase
      .from('learned_rules')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('category', divergenceType)
      .eq('is_active', true)
      .order('severity', { ascending: false })
      .limit(1)
      .single();

    // 4. Montar análise
    const severity = rule?.severity || 'medium';
    const suggestedResolution = rule?.action_description || this.getDefaultResolution(divergenceType);

    return {
      type: divergenceType,
      severity: severity as any,
      description: this.getDescription(divergenceType, details),
      historicalContext,
      suggestedResolution
    };
  }

  /**
   * Gera parecer formal do Dr. Cícero
   */
  async generateOpinion(
    situation: string,
    analysis: DivergenceAnalysis
  ): Promise<string> {
    const { historicalContext } = analysis;

    let opinion = `
Dr. Cícero — Parecer Técnico

Contexto:
${situation}

Fontes analisadas:
- Regras aprendidas: ${historicalContext.precedents.length}
- Casos similares: ${historicalContext.similarCases.length}
- Confiança: ${historicalContext.confidence.toUpperCase()}

`;

    if (historicalContext.hasHistory) {
      opinion += `Histórico:
`;
      historicalContext.precedents.forEach(p => {
        opinion += `• ${p.rule_name}: ${p.occurrences} ocorrência(s), última em ${p.lastOccurrence}
`;
      });

      if (historicalContext.similarCases.length > 0) {
        opinion += `
Casos similares recentes:
`;
        historicalContext.similarCases.slice(0, 3).forEach(c => {
          opinion += `• ${new Date(c.date).toLocaleDateString('pt-BR')}: ${c.description}
`;
        });
      }
    } else {
      opinion += `Histórico:
Não encontrado no Data Lake. Aplicando princípios contábeis fundamentais.

`;
    }

    opinion += `
Análise:
Severidade: ${analysis.severity.toUpperCase()}
${analysis.description}

Decisão:
${analysis.suggestedResolution}

---
Dr. Cícero
Contador Responsável — Sistema Contta
`;

    return opinion;
  }

  /**
   * Registra decisão para aprendizado
   */
  async recordDecision(
    divergenceType: string,
    decision: string,
    outcome: string
  ): Promise<void> {
    // 1. Atualizar contador na regra existente (se houver)
    const { data: existingRule } = await supabase
      .from('learned_rules')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('category', divergenceType)
      .single();

    if (existingRule) {
      await supabase
        .from('learned_rules')
        .update({
          occurrence_count: existingRule.occurrence_count + 1,
          last_occurrence: new Date().toISOString().split('T')[0],
          example_cases: [
            ...(existingRule.example_cases || []).slice(-9),
            { date: new Date().toISOString(), decision, outcome }
          ],
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRule.id);
    }
  }

  // ============================================================================
  // HELPERS PRIVADOS
  // ============================================================================

  private getKeywordsForDivergence(type: string): string[] {
    const mapping: Record<string, string[]> = {
      'reconciliation': ['reconciliação', 'status', 'pendente', 'journal_entry'],
      'classification': ['classificação', 'conta', 'transitória', 'despesa', 'receita'],
      'validation': ['validação', 'integridade', 'fechamento', 'auditoria'],
      'pix_socio': ['pix', 'sócio', 'aporte', 'empréstimo', 'capital']
    };
    return mapping[type] || [type];
  }

  private deriveRecommendation(
    precedents: Precedent[],
    cases: SimilarCase[]
  ): string {
    if (precedents.length === 0 && cases.length === 0) {
      return 'Aplicar tratamento conservador conforme princípios contábeis fundamentais.';
    }

    if (precedents.length > 0) {
      const mostCommon = precedents[0];
      return `Seguir precedente "${mostCommon.rule_name}": ${mostCommon.action}`;
    }

    return 'Analisar manualmente com base em casos similares encontrados.';
  }

  private getDefaultResolution(type: string): string {
    const defaults: Record<string, string> = {
      'reconciliation': 'Usar RPC reconcile_transaction() para garantir consistência e auditoria.',
      'classification': 'Manter em transitória até confirmação. Encaminhar para aprovação manual.',
      'validation': 'Corrigir inconsistência antes do fechamento mensal.',
      'pix_socio': 'BLOQUEADO como receita. Classificar como Empréstimo de Sócio ou Capital Social.'
    };
    return defaults[type] || 'Analisar manualmente. Registrar decisão para histórico.';
  }

  private getDescription(type: string, details: Record<string, any>): string {
    const templates: Record<string, (d: any) => string> = {
      'reconciliation': (d) => `Transação ${d.transaction_id || 'N/A'} com inconsistência de status.`,
      'classification': (d) => `Transação de R$ ${d.amount || 0} aguardando classificação.`,
      'validation': (d) => `Erro de validação: ${d.error || 'Não especificado'}`,
      'pix_socio': (d) => `PIX de R$ ${d.amount || 0} identificado como possível movimentação de sócio.`
    };
    return templates[type]?.(details) || `Situação do tipo "${type}" requer análise.`;
  }
}

// ============================================================================
// FUNÇÃO DE CONSULTA RAG (Compatível com prompt do Dr. Cícero)
// ============================================================================

export async function searchDocumentsForRAG(
  tenantId: string,
  query: string,
  documentType?: string,
  tags?: string[],
  limit: number = 10
): Promise<any[]> {
  let queryBuilder = supabase
    .from('document_catalog')
    .select('*')
    .eq('tenant_id', tenantId);

  if (documentType) {
    queryBuilder = queryBuilder.eq('document_type', documentType);
  }

  if (tags && tags.length > 0) {
    queryBuilder = queryBuilder.contains('tags', tags);
  }

  const { data, error } = await queryBuilder
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro na consulta RAG:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca contexto de divergência para meses anteriores
 */
export async function getDivergenceContext(
  tenantId: string,
  referenceMonth: string,
  monthsBack: number = 6
): Promise<any[]> {
  const startDate = new Date(referenceMonth);
  startDate.setMonth(startDate.getMonth() - monthsBack);

  const { data, error } = await supabase
    .from('document_catalog')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('document_type', 'parecer')
    .gte('reference_month', startDate.toISOString().split('T')[0])
    .lte('reference_month', referenceMonth)
    .order('reference_month', { ascending: false });

  if (error) {
    console.error('Erro ao buscar contexto de divergência:', error);
    return [];
  }

  return data || [];
}

/**
 * Timeline de decisões
 */
export async function getDecisionTimeline(
  tenantId: string,
  monthsBack: number = 12
): Promise<any[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);

  const { data, error } = await supabase
    .from('reconciliation_audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar timeline:', error);
    return [];
  }

  return data || [];
}
