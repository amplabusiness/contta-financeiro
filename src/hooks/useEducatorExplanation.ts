/**
 * useEducatorExplanation.ts
 * 
 * Hook para o Agente Educador - explica o "porquê" das decisões contábeis.
 * Transforma o Contta em ferramenta + professor + auditor + analista.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from './useTenantConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface ExplanationContext {
  type: 'classification' | 'reclassification' | 'split' | 'rejection' | 'error' | 'best_practice';
  transactionDescription?: string;
  amount?: number;
  isIncome?: boolean;
  currentAccount?: {
    code: string;
    name: string;
    type: string;
  };
  suggestedAccount?: {
    code: string;
    name: string;
    type: string;
  };
  rejectedAccount?: {
    code: string;
    name: string;
    type: string;
    reason: string;
  };
  errorCode?: string;
  errorMessage?: string;
}

export interface Explanation {
  title: string;
  summary: string;
  details: ExplanationDetail[];
  relatedConcepts: RelatedConcept[];
  examples?: ExplanationExample[];
  sources?: string[];
  level: 'beginner' | 'intermediate' | 'advanced';
}

export interface ExplanationDetail {
  topic: string;
  content: string;
  importance: 'critical' | 'important' | 'informative';
  icon?: string;
}

export interface RelatedConcept {
  term: string;
  definition: string;
  link?: string;
}

export interface ExplanationExample {
  scenario: string;
  correct: string;
  incorrect?: string;
  why: string;
}

// ============================================================================
// KNOWLEDGE BASE - Explicações pré-definidas
// ============================================================================

const EXPLANATION_TEMPLATES: Record<string, Partial<Explanation>> = {
  // Por que PIX de sócio não é receita
  pix_socio_nao_receita: {
    title: 'Por que PIX de sócio NÃO é receita?',
    summary: 'Transferências entre sócios e a empresa não representam faturamento, mas sim movimentação de capital próprio.',
    details: [
      {
        topic: 'Conceito Contábil',
        content: 'Receita é o ingresso bruto de benefícios econômicos decorrentes das atividades ordinárias da empresa. Dinheiro de sócio é capital, não faturamento.',
        importance: 'critical',
        icon: '📚'
      },
      {
        topic: 'Norma Aplicável',
        content: 'NBC TG 47 (CPC 47) define que receita é reconhecida apenas quando há transferência de controle de bens ou serviços ao cliente.',
        importance: 'important',
        icon: '⚖️'
      },
      {
        topic: 'Impacto Fiscal',
        content: 'Classificar como receita geraria pagamento indevido de impostos (ISS, PIS, COFINS, IRPJ, CSLL) sobre valor que não é faturamento.',
        importance: 'critical',
        icon: '💰'
      }
    ],
    relatedConcepts: [
      { term: 'Capital Social', definition: 'Valor investido pelos sócios na empresa' },
      { term: 'Aporte', definition: 'Investimento adicional de capital pelos sócios' },
      { term: 'Empréstimo de Sócio', definition: 'Valor emprestado pelo sócio à empresa, com devolução prevista' },
      { term: 'Receita Operacional', definition: 'Faturamento decorrente da atividade principal da empresa' }
    ],
    examples: [
      {
        scenario: 'Sócio transfere R$ 50.000 para cobrir despesas do mês',
        correct: 'D - Banco / C - Empréstimo de Sócios (Passivo)',
        incorrect: 'D - Banco / C - Receita de Serviços (ERRADO!)',
        why: 'Não houve prestação de serviço ao sócio. É um empréstimo que deverá ser devolvido.'
      }
    ],
    level: 'beginner'
  },

  // Por que transitórias devem zerar
  transitorias_devem_zerar: {
    title: 'Por que as Transitórias devem zerar?',
    summary: 'Contas transitórias são temporárias - servem apenas para aguardar classificação. Saldo remanescente indica transações não identificadas.',
    details: [
      {
        topic: 'Função da Transitória',
        content: 'É uma "sala de espera" contábil. O dinheiro entra ou sai do banco, mas ainda não sabemos para qual conta vai. A transitória segura até identificarmos.',
        importance: 'critical',
        icon: '⏳'
      },
      {
        topic: 'Regra de Fechamento',
        content: 'No fechamento mensal, todas as transações devem estar classificadas. Saldo na transitória = transações pendentes de identificação.',
        importance: 'critical',
        icon: '🔒'
      },
      {
        topic: 'Auditoria',
        content: 'Auditores verificam se as transitórias estão zeradas. Saldo indica controle interno deficiente.',
        importance: 'important',
        icon: '🔍'
      }
    ],
    relatedConcepts: [
      { term: 'Conciliação Bancária', definition: 'Conferência entre extrato e contabilidade' },
      { term: 'Fechamento Mensal', definition: 'Processo de encerrar as contas do período' },
      { term: 'Partidas Dobradas', definition: 'Todo débito tem um crédito correspondente' }
    ],
    examples: [
      {
        scenario: 'Recebimento PIX de R$ 1.000 sem identificação',
        correct: '1º D-Banco/C-Transitória | 2º D-Transitória/C-Cliente (quando identificar)',
        why: 'O dinheiro entra no banco imediatamente, mas a baixa do cliente só pode ser feita quando soubermos quem pagou.'
      }
    ],
    level: 'intermediate'
  },

  // Por que reclassificação não altera saldo
  reclassificacao_nao_altera_saldo: {
    title: 'Por que reclassificação NÃO altera saldo bancário?',
    summary: 'Reclassificação corrige ONDE foi registrado, não QUANTO entrou ou saiu. O banco já teve sua movimentação registrada.',
    details: [
      {
        topic: 'O que é Reclassificação',
        content: 'É a correção da conta contábil onde uma transação foi classificada. O valor não muda, apenas a categoria.',
        importance: 'critical',
        icon: '🔄'
      },
      {
        topic: 'Fluxo Correto',
        content: 'Reclassificar move entre contas de resultado (despesas/receitas) ou patrimoniais, nunca entre banco e outra conta.',
        importance: 'important',
        icon: '➡️'
      },
      {
        topic: 'Rastro de Auditoria',
        content: 'O lançamento original é mantido, e um novo lançamento de reclassificação é criado, preservando o histórico.',
        importance: 'important',
        icon: '📋'
      }
    ],
    relatedConcepts: [
      { term: 'Estorno', definition: 'Anulação completa de um lançamento' },
      { term: 'Ajuste Contábil', definition: 'Correção de valores ou classificações' },
      { term: 'Auditoria Trail', definition: 'Rastro de todas as alterações para auditoria' }
    ],
    examples: [
      {
        scenario: 'Pagamento de R$ 500 classificado como "Despesas Diversas", mas era "Material de Escritório"',
        correct: 'D-Material Escritório/C-Despesas Diversas (reclassifica)',
        incorrect: 'D-Banco/C-Despesas Diversas (ERRADO! altera saldo)',
        why: 'O dinheiro já saiu do banco. Estamos apenas corrigindo a categoria da despesa.'
      }
    ],
    level: 'intermediate'
  },

  // Conta define natureza
  conta_define_natureza: {
    title: 'Por que a CONTA define a natureza, não o valor?',
    summary: 'O valor é apenas quantidade. A conta contábil é quem diz se é despesa, receita, ativo ou passivo.',
    details: [
      {
        topic: 'Princípio Fundamental',
        content: 'Na contabilidade, R$ 1.000 pode ser despesa, receita ou dívida - depende de ONDE você registra, não do valor.',
        importance: 'critical',
        icon: '🎯'
      },
      {
        topic: 'Estrutura do Plano de Contas',
        content: 'Grupo 1 = Ativo, Grupo 2 = Passivo, Grupo 3 = Receitas, Grupo 4 = Despesas, Grupo 5 = PL. O número define a natureza.',
        importance: 'important',
        icon: '📊'
      },
      {
        topic: 'Débito vs Crédito',
        content: 'Ativo/Despesa aumentam com débito. Passivo/Receita/PL aumentam com crédito. A conta determina o comportamento.',
        importance: 'critical',
        icon: '⚖️'
      }
    ],
    relatedConcepts: [
      { term: 'Natureza Devedora', definition: 'Contas que aumentam com débito (Ativo, Despesa)' },
      { term: 'Natureza Credora', definition: 'Contas que aumentam com crédito (Passivo, Receita, PL)' },
      { term: 'Plano de Contas', definition: 'Estrutura hierárquica das contas da empresa' }
    ],
    level: 'beginner'
  },

  // Split deve somar exatamente
  split_soma_exata: {
    title: 'Por que o Split deve somar EXATAMENTE o valor original?',
    summary: 'Split divide uma transação em partes, mas o total deve bater. Diferença geraria inconsistência contábil.',
    details: [
      {
        topic: 'Partidas Dobradas',
        content: 'Toda entrada ou saída tem contrapartida. Se você divide em 3 partes, a soma das 3 deve igualar o original.',
        importance: 'critical',
        icon: '➕'
      },
      {
        topic: 'Conciliação Bancária',
        content: 'O banco mostra R$ 1.000 saindo. Se você registrar R$ 999, terá R$ 1 de diferença que nunca fechará.',
        importance: 'critical',
        icon: '🏦'
      },
      {
        topic: 'Exemplo Prático',
        content: 'Pagamento de R$ 1.000 = R$ 600 salário + R$ 300 INSS + R$ 100 FGTS. Soma = R$ 1.000 ✓',
        importance: 'informative',
        icon: '✅'
      }
    ],
    relatedConcepts: [
      { term: 'Rateio', definition: 'Divisão proporcional de valores entre centros de custo' },
      { term: 'Apropriação', definition: 'Atribuição de valor a uma conta específica' }
    ],
    level: 'beginner'
  }
};

// ============================================================================
// HOOK
// ============================================================================

export function useEducatorExplanation() {
  const { tenant } = useTenantConfig();
  const tenantId = tenant?.id;

  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Gera explicação baseada no contexto
   */
  const generateExplanation = useCallback(async (
    context: ExplanationContext
  ): Promise<Explanation | null> => {
    setLoading(true);
    setError(null);

    try {
      // 1. Tentar usar template local primeiro
      const templateKey = detectTemplateKey(context);
      if (templateKey && EXPLANATION_TEMPLATES[templateKey]) {
        const template = EXPLANATION_TEMPLATES[templateKey];
        const customized = customizeTemplate(template, context);
        setExplanation(customized as Explanation);
        return customized as Explanation;
      }

      // 2. Se não houver template, usar IA
      const { data: aiExplanation, error: aiError } = await supabase.functions
        .invoke('dr-cicero-brain', {
          body: {
            tenant_id: tenantId,
            mode: 'educator',
            context: {
              action: context.type,
              description: context.transactionDescription,
              amount: context.amount,
              is_income: context.isIncome,
              current_account: context.currentAccount,
              suggested_account: context.suggestedAccount,
              rejected_account: context.rejectedAccount,
              error: context.errorCode ? {
                code: context.errorCode,
                message: context.errorMessage
              } : undefined
            },
            request: 'Explique de forma didática por que esta classificação está correta ou incorreta. ' +
                     'Use linguagem simples mas tecnicamente precisa. ' +
                     'Inclua a norma contábil aplicável quando relevante.'
          }
        });

      if (aiError) throw aiError;

      // Formatar resposta da IA
      const formattedExplanation: Explanation = {
        title: aiExplanation.title || 'Explicação do Contador',
        summary: aiExplanation.summary || aiExplanation.response,
        details: aiExplanation.details || [{
          topic: 'Análise',
          content: aiExplanation.response,
          importance: 'important' as const
        }],
        relatedConcepts: aiExplanation.concepts || [],
        examples: aiExplanation.examples,
        sources: aiExplanation.sources,
        level: 'intermediate'
      };

      setExplanation(formattedExplanation);
      return formattedExplanation;

    } catch (err: any) {
      const message = err.message || 'Erro ao gerar explicação';
      setError(message);
      
      // Fallback para explicação genérica
      const fallback = generateFallbackExplanation(context);
      setExplanation(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  /**
   * Explica por que uma conta foi rejeitada
   */
  const explainRejection = useCallback(async (
    accountCode: string,
    accountName: string,
    reason: string,
    transactionDescription?: string
  ): Promise<Explanation | null> => {
    return generateExplanation({
      type: 'rejection',
      transactionDescription,
      rejectedAccount: {
        code: accountCode,
        name: accountName,
        type: 'unknown',
        reason
      }
    });
  }, [generateExplanation]);

  /**
   * Explica um erro do sistema
   */
  const explainError = useCallback(async (
    errorCode: string,
    errorMessage: string
  ): Promise<Explanation | null> => {
    return generateExplanation({
      type: 'error',
      errorCode,
      errorMessage
    });
  }, [generateExplanation]);

  /**
   * Explica uma melhor prática
   */
  const explainBestPractice = useCallback(async (
    topic: string
  ): Promise<Explanation | null> => {
    // Mapear tópico para template
    const topicMap: Record<string, string> = {
      'pix_socio': 'pix_socio_nao_receita',
      'transitoria': 'transitorias_devem_zerar',
      'reclassificacao': 'reclassificacao_nao_altera_saldo',
      'natureza': 'conta_define_natureza',
      'split': 'split_soma_exata'
    };

    const templateKey = topicMap[topic];
    if (templateKey && EXPLANATION_TEMPLATES[templateKey]) {
      const template = EXPLANATION_TEMPLATES[templateKey];
      setExplanation(template as Explanation);
      return template as Explanation;
    }

    return generateExplanation({
      type: 'best_practice',
      transactionDescription: topic
    });
  }, [generateExplanation]);

  /**
   * Limpa explicação atual
   */
  const clearExplanation = useCallback(() => {
    setExplanation(null);
    setError(null);
  }, []);

  return {
    loading,
    explanation,
    error,
    generateExplanation,
    explainRejection,
    explainError,
    explainBestPractice,
    clearExplanation
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectTemplateKey(context: ExplanationContext): string | null {
  // PIX de sócio
  if (context.rejectedAccount?.reason?.toLowerCase().includes('sócio') ||
      context.transactionDescription?.toLowerCase().includes('sócio')) {
    return 'pix_socio_nao_receita';
  }

  // Transitórias
  if (context.currentAccount?.code?.includes('9.01') ||
      context.suggestedAccount?.code?.includes('9.01')) {
    return 'transitorias_devem_zerar';
  }

  // Reclassificação
  if (context.type === 'reclassification') {
    return 'reclassificacao_nao_altera_saldo';
  }

  // Split
  if (context.type === 'split') {
    return 'split_soma_exata';
  }

  return null;
}

function customizeTemplate(
  template: Partial<Explanation>,
  context: ExplanationContext
): Partial<Explanation> {
  const customized = { ...template };

  // Adicionar valores específicos do contexto
  if (context.amount) {
    customized.summary = customized.summary?.replace(
      /R\$ [\d.,]+/g,
      `R$ ${context.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    );
  }

  if (context.transactionDescription) {
    customized.details = [
      {
        topic: 'Contexto da Transação',
        content: `Esta explicação se aplica à transação: "${context.transactionDescription}"`,
        importance: 'informative' as const,
        icon: '📝'
      },
      ...(customized.details || [])
    ];
  }

  return customized;
}

function generateFallbackExplanation(context: ExplanationContext): Explanation {
  return {
    title: 'Orientação Contábil',
    summary: `Esta ${context.type === 'classification' ? 'classificação' : 'operação'} segue as boas práticas contábeis estabelecidas.`,
    details: [
      {
        topic: 'Regra Aplicada',
        content: 'Toda movimentação financeira deve ser classificada em uma conta contábil adequada à sua natureza.',
        importance: 'important'
      },
      {
        topic: 'Dúvidas?',
        content: 'Consulte o Dr. Cícero para orientações específicas sobre esta classificação.',
        importance: 'informative'
      }
    ],
    relatedConcepts: [
      { term: 'Classificação Contábil', definition: 'Atribuição de uma conta do plano de contas a uma transação' }
    ],
    level: 'beginner'
  };
}

export default useEducatorExplanation;
