/**
 * Índice dos Módulos Operacionais - MCP Financeiro
 *
 * Este arquivo exporta todos os módulos funcionais do MCP,
 * incluindo integrações, análises e automações.
 */

// ============================================
// MÓDULOS DE INTEGRAÇÃO
// ============================================

// WhatsApp - Cobrança automatizada
export * from "./whatsapp-cobranca.js";
export { default as whatsappCobranca } from "./whatsapp-cobranca.js";

// ============================================
// MÓDULOS DE RELATÓRIOS
// ============================================

// Gerador de PDF
export * from "./relatorios-pdf.js";
export { default as relatoriosPdf } from "./relatorios-pdf.js";

// ============================================
// MÓDULOS DE ANÁLISE
// ============================================

// Previsão de Fluxo de Caixa
export * from "./previsao-fluxo-caixa.js";
export { default as previsaoFluxoCaixa } from "./previsao-fluxo-caixa.js";

// Análise de Churn
export * from "./analise-churn.js";
export { default as analiseChurn } from "./analise-churn.js";

// Comparativo de Honorários
export * from "./comparativo-honorarios.js";
export { default as comparativoHonorarios } from "./comparativo-honorarios.js";

// ============================================
// MÓDULOS DE AUTOMAÇÃO
// ============================================

// Conciliação Bancária
export * from "./conciliacao-bancaria.js";
export { default as conciliacaoBancaria } from "./conciliacao-bancaria.js";

// ============================================
// MÓDULOS DE GESTÃO
// ============================================

// Dashboard de Metas/OKRs
export * from "./dashboard-metas.js";
export { default as dashboardMetas } from "./dashboard-metas.js";

// ============================================
// RESUMO DOS MÓDULOS DISPONÍVEIS
// ============================================

/**
 * MÓDULOS DISPONÍVEIS:
 *
 * 1. WHATSAPP COBRANÇA (whatsapp-cobranca.ts)
 *    - Integração com WhatsApp Cloud API (Meta)
 *    - Régua de cobrança automatizada
 *    - Templates de mensagens
 *    - Envio de boletos e PIX
 *    - Processamento em lote
 *
 * 2. RELATÓRIOS PDF (relatorios-pdf.ts)
 *    - Geração de DRE
 *    - Balanço Patrimonial
 *    - Balancete
 *    - Fluxo de Caixa
 *    - Relatórios de Inadimplência
 *    - Templates HTML para PDF
 *
 * 3. PREVISÃO DE FLUXO DE CAIXA (previsao-fluxo-caixa.ts)
 *    - Projeção de recebimentos
 *    - Projeção de despesas
 *    - Cálculo de probabilidade de recebimento
 *    - Análise de sazonalidade
 *    - Alertas de caixa negativo
 *    - Indicadores de cobertura operacional
 *
 * 4. ANÁLISE DE CHURN (analise-churn.ts)
 *    - Score de risco por cliente
 *    - Fatores de risco identificados
 *    - Ações recomendadas
 *    - Análise geral da carteira
 *    - Impacto financeiro projetado
 *
 * 5. COMPARATIVO DE HONORÁRIOS (comparativo-honorarios.ts)
 *    - Tabela de referência de mercado (Goiânia)
 *    - Cálculo de custo por cliente
 *    - Análise de rentabilidade
 *    - Sugestões de reajuste
 *    - Comparativo por regime tributário
 *
 * 6. CONCILIAÇÃO BANCÁRIA (conciliacao-bancaria.ts)
 *    - Match automático de transações
 *    - Identificação de PIX
 *    - Classificação automática
 *    - Relatório de diferenças
 *    - Alertas de pendências
 *
 * 7. DASHBOARD DE METAS (dashboard-metas.ts)
 *    - Metodologia OKR
 *    - Acompanhamento de objetivos
 *    - Key Results mensuráveis
 *    - Iniciativas vinculadas
 *    - Alertas e tendências
 *    - Ranking de responsáveis
 */
