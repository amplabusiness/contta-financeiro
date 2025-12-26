/**
 * Índice dos Módulos de Conhecimento - MCP Financeiro
 *
 * Este arquivo exporta toda a base de conhecimento do MCP,
 * permitindo acesso unificado a todas as regras e funções.
 */

// Base de conhecimento principal
export * from "./base-conhecimento.js";
export { default as baseConhecimento } from "./base-conhecimento.js";

// Identificação de PIX e pagamentos
export * from "./pix-identificacao.js";
export { default as pixIdentificacao } from "./pix-identificacao.js";

// Emissão de NFS-e
export * from "./nfse-emissao.js";
export { default as nfseEmissao } from "./nfse-emissao.js";

// Re-exportar tipos úteis
export type {
  ResultadoIdentificacao,
} from "./pix-identificacao.js";

/**
 * Resumo do que está disponível:
 *
 * 1. BASE DE CONHECIMENTO (base-conhecimento.ts)
 *    - Regras contábeis NBC/CFC
 *    - Partida dobrada e plano de contas
 *    - Regras fiscais (Simples, Lucro Presumido, Lucro Real)
 *    - Retenções na fonte (ISS, IRRF, PIS, COFINS, CSLL, INSS)
 *    - Departamento pessoal (eSocial, folha, férias, 13º, rescisão)
 *    - Auditoria e controles internos
 *    - Regras específicas Ampla Contabilidade
 *    - Funções auxiliares (calcular INSS, validar partida dobrada, etc)
 *
 * 2. IDENTIFICAÇÃO DE PIX (pix-identificacao.ts)
 *    - Padrões de descrição PIX
 *    - Extração de CPF/CNPJ/nome
 *    - Estratégias de match de cliente
 *    - Regras de inadimplência
 *    - Régua de cobrança
 *    - Templates de mensagem
 *    - Função calcularScoreMatch()
 *
 * 3. EMISSÃO DE NFS-e (nfse-emissao.ts)
 *    - Códigos de serviço LC 116/2003
 *    - Campos obrigatórios
 *    - Retenções na fonte
 *    - Natureza da operação
 *    - Passo a passo de emissão
 *    - Erros comuns e prevenção
 *    - Específico Goiânia
 *    - Função calcularRetencoes()
 *    - Função gerarDescricaoServico()
 */
