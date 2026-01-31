import { supabase } from "@/integrations/supabase/client";
import { accountingService } from "@/services/AccountingService";

/**
 * ============================================================================
 * FINANCIAL INTELLIGENCE SERVICE
 * ============================================================================
 * 
 * REGRA DE OURO (Dr. Cícero - 30/01/2026):
 * 
 * 🔴 PIX NUNCA GERA RECEITA AUTOMATICAMENTE
 * 🔴 BANCO GERA APENAS CONTAS PATRIMONIAIS
 * 🔴 RECEITA NASCE EXCLUSIVAMENTE DO MÓDULO DE HONORÁRIOS
 * 
 * Fluxo correto:
 * 1. Entrada no banco → D Banco / C Transitória Créditos
 * 2. Classificação → D Transitória / C [Conta de Origem]
 * 
 * A conta de origem NUNCA é receita (3.x) direto do banco!
 * Receita vem do cadastro de honorários (fee_configurations)
 * 
 * ============================================================================
 */

// Tipos
export interface OpeningBalance {
    clientId: string;
    clientName: string;
    totalAmount: number;
    accountingEntryId: string;
}

export interface ClassificationSuggestion {
    description: string;
    type: 'pending_classification' | 'ai_suggestion' | 'revenue_current' | 'revenue_past' | 'expense_current' | 'split' | 'loan' | 'transfer';
    rule_id?: string;
    confidence?: number;
    entries: {
        debit: { account: string; name: string };
        credit: { account: string; name: string };
        value: number;
    }[];
    reasoning: string;
    
    // Novo: flag para indicar se precisa de revisão obrigatória
    requires_review?: boolean;
    // Novo: contas sugeridas para classificação
    suggested_accounts?: { id: string; code: string; name: string }[];
}

export const FinancialIntelligenceService = {

    /**
     * Ensina o Dr. Cicero uma nova regra baseada no padrão da descrição
     */
    async learnRule(pattern: string, accountCode: string, accountName: string, operation: 'debit' | 'credit') {
        try {
             // Limpa o padrão para evitar lixo
             const cleanPattern = pattern.split('-')[0].trim(); // Pega "RECEBIMENTO PIX" ou nome se houver
             // Melhor: Usar o input do usuário ou tratar aqui. 
             // Vamos usar o padrão exato passado por enquanto.
             
             // Basic de-duplication
             const { data } = await supabase.from('intelligence_rules').select('id').eq('pattern', pattern).maybeSingle();
             if (data) return; 

             await supabase.from('intelligence_rules').insert({
                 pattern: pattern,
                 account_code: accountCode,
                 account_name: accountName,
                 operation_type: operation
             });
             console.log(`Dr. Cicero aprendeu: ${pattern} -> ${accountName}`);
        } catch (e) {
            console.error("Erro ao aprender regra:", e);
        }
    },

    /**
     * Busca regras aprendidas
     */
    async findRule(description: string): Promise<{code: string, name: string} | null> {
         try {
             // Otimização: buscar apenas se a tabela existir e tiver dados
             // Idealmente, deveríamos usar um RPC ou indexação, mas por enquanto, select all é arriscado se a tabela crescer
             // Vamos filtrar pelo menos algo se possível, mas como é 'contains', é dificil no SQL simples sem Full Text Search
             // Entao vamos manter o select all MAS silenciar o erro se a tabela não existir
             const { data, error } = await supabase.from('intelligence_rules').select('*');
             if (error) throw error;
             
             if (!data || data.length === 0) return null;

             // Ordena por especificidade (match mais longo vence) -> opcional
             const match = data
                .filter(rule => description.toUpperCase().includes(rule.pattern.toUpperCase()))
                .sort((a, b) => b.pattern.length - a.pattern.length)[0];

             if (match) {
                 // Non-blocking increment
                 supabase.rpc('increment_rule_usage', { rule_id: match.id }).then(({ error }) => {
                     if (error) console.warn('Failed to increment rule usage:', error.message);
                 });
                 
                 return { code: match.account_code, name: match.account_name || 'Conta Aprendida' };
             }
         } catch (e) {
             console.warn("Dr. Cicero (Memória): Tabela de regras não acessível ou vazia.", e);
         }
         return null;
    },

    /**
     * Busca saldos de abertura (dívidas anteriores a 2025)
     * Baseado na conta "1.1.2.01" (Clientes a Receber) vs "2.3.03.02" / "5.3.02.02" (Contrapartida)
     */
    async getPre2025Receivables(): Promise<OpeningBalance[]> {
        console.log("Dr. Cicero: Investigando saldos passados...");
        
        // 1. Buscar linhas de lançamento contábil ANTES de 2025
        // que debitam a conta de Clientes a Receber (1.1.2.01)
        // e creditam a conta de Saldo de Abertura (2.3.03.02 ou antigas 5.x)
        
        const { data, error } = await supabase
            .from('accounting_entry_lines')
            .select(`
                id, account_id, debit, credit, description,
                chart_of_accounts!inner(code, name),
                accounting_entries!inner(id, competence_date, description)
            `)
            .lt('accounting_entries.competence_date', '2025-01-01') // Apenas passado
            .gt('debit', 0) // Tem que ser débito no cliente
            .ilike('chart_of_accounts.code', '1.1.2.01%'); // Clientes a Receber

        if (error) {
            console.error("Erro ao buscar saldos antigos:", error);
            return [];
        }

        // Agrupar por cliente (baseado na descrição ou algum metadado se possível)
        // Como o sistema evoluiu, podemos ter nomes na descrição.
        const balances: Record<string, OpeningBalance> = {};

        data.forEach(line => {
            // Tenta extrair nome do cliente da descrição "Saldo Abertura - NOME"
            // Isso é um Heurística do Dr. Cicero
            let clientName = "Desconhecido";
            const desc = line.description || line.accounting_entries?.description || "";
            
            if (desc.includes("-")) {
                const parts = desc.split("-");
                if (parts.length > 1) clientName = parts[1].trim();
            } else {
                clientName = desc;
            }

            // Usar ID como chave por enquanto (precisaria do client_id real se mapeado)
            const key = clientName; 

            if (!balances[key]) {
                balances[key] = {
                    clientId: "unknown", // Idealmente mapear para clients.id
                    clientName: clientName,
                    totalAmount: 0,
                    accountingEntryId: line.accounting_entries.id
                };
            }
            balances[key].totalAmount += Number(line.debit);
        });

        return Object.values(balances);
    },

    /**
     * Analisa uma transação bancária e sugere a contabilização
     * 
     * ⚠️ REGRA DE OURO (Dr. Cícero):
     * - PIX NUNCA gera Receita automaticamente
     * - Banco gera APENAS contas patrimoniais
     * - Receita de Honorários nasce do módulo de Honorários
     */
    async analyzeBankTransaction(
        amount: number, 
        date: string, 
        description: string,
        bankAccountCode: string = "1.1.1.05", // Banco Sicredi padrão
        tenantId?: string
    ): Promise<ClassificationSuggestion> {
        const transactionDate = new Date(date);
        const isReceipt = amount > 0;
        const absAmount = Math.abs(amount);
        
        // Contas transitórias (SEMPRE usadas na importação)
        const TRANSITORIA_CREDITOS = { code: '2.1.9.01', name: 'Transitória Créditos (Entradas)' };
        const TRANSITORIA_DEBITOS = { code: '1.1.9.01', name: 'Transitória Débitos (Saídas)' };
        
        // =====================================================================
        // PASSO 1: Verificar regras de aprendizado assistido
        // =====================================================================
        const learnedRule = await this.findRule(description);
        
        if (learnedRule) {
            // Verificar se a regra aprendida é para conta de RECEITA
            // Se for, BLOQUEAR - PIX não pode gerar receita diretamente!
            if (learnedRule.code.startsWith('3.')) {
                console.warn('[FinancialIntelligence] BLOQUEADO: Regra tentou classificar PIX como receita diretamente');
                
                // Retornar para classificação manual com sugestão de cliente
                return {
                    description: "⚠️ ATENÇÃO: Possível recebimento de cliente",
                    type: "ai_suggestion",
                    confidence: 70,
                    requires_review: true,
                    entries: [{
                        // Lançamento 1: Importação (SEMPRE transitória)
                        debit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        credit: { account: TRANSITORIA_CREDITOS.code, name: TRANSITORIA_CREDITOS.name },
                        value: absAmount
                    }],
                    reasoning: `⚠️ Padrão identificado: "${learnedRule.name}" mas PIX não pode gerar receita diretamente. ` +
                              `Verifique se há fatura pendente para este cliente. ` +
                              `Classificação correta: D Transitória / C Clientes a Receber`,
                    suggested_accounts: [
                        { id: '', code: '1.1.2.01', name: 'Clientes a Receber (baixa de honorários)' },
                        { id: '', code: '2.1.2.03', name: 'Empréstimos de Sócios (aporte)' },
                        { id: '', code: '2.4.1.01', name: 'Adiant. Futuro Aumento Capital' }
                    ]
                };
            }
            
            // Regra aprendida para conta patrimonial - OK usar
            if (isReceipt) {
                return {
                    description: `Sugestão IA: ${learnedRule.name}`,
                    type: "ai_suggestion",
                    confidence: 80,
                    requires_review: true,
                    entries: [{
                        debit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        credit: { account: TRANSITORIA_CREDITOS.code, name: TRANSITORIA_CREDITOS.name },
                        value: absAmount
                    }, {
                        // Sugestão de classificação
                        debit: { account: TRANSITORIA_CREDITOS.code, name: TRANSITORIA_CREDITOS.name },
                        credit: { account: learnedRule.code, name: learnedRule.name },
                        value: absAmount
                    }],
                    reasoning: `Regra aprendida aplicada. Aguardando validação.`
                };
            } else {
                return {
                    description: `Sugestão IA: ${learnedRule.name}`,
                    type: "ai_suggestion",
                    confidence: 80,
                    requires_review: true,
                    entries: [{
                        debit: { account: TRANSITORIA_DEBITOS.code, name: TRANSITORIA_DEBITOS.name },
                        credit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        value: absAmount
                    }, {
                        debit: { account: learnedRule.code, name: learnedRule.name },
                        credit: { account: TRANSITORIA_DEBITOS.code, name: TRANSITORIA_DEBITOS.name },
                        value: absAmount
                    }],
                    reasoning: `Regra aprendida aplicada. Aguardando validação.`
                };
            }
        }

        // =====================================================================
        // PASSO 2: Tentar identificar automaticamente pelo padrão
        // =====================================================================
        const descUpper = (description || '').toUpperCase();
        
        if (isReceipt) {
            // ========================================
            // ENTRADA DE DINHEIRO
            // ========================================
            
            // Verificar se é LOTE (precisa split)
            if (descUpper.includes("LOTE") || descUpper.includes("LIQUIDACAO")) {
                return {
                    description: "Recebimento em Lote (requer split)",
                    type: "split",
                    requires_review: true,
                    entries: [{
                        debit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        credit: { account: TRANSITORIA_CREDITOS.code, name: TRANSITORIA_CREDITOS.name },
                        value: absAmount
                    }],
                    reasoning: "Transação identificada como LOTE. Necessário arquivo de detalhamento para classificação individual."
                };
            }
            
            // Detectar possível empréstimo de sócio
            const socioKeywords = ['SERGIO', 'CARNEIRO', 'SOCIO', 'APORTE', 'EMPRESTIMO'];
            const isSocioRelated = socioKeywords.some(kw => descUpper.includes(kw));
            
            if (isSocioRelated || absAmount >= 50000) {
                return {
                    description: "⚠️ Possível empréstimo/aporte de sócio",
                    type: "loan",
                    requires_review: true,
                    entries: [{
                        debit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        credit: { account: TRANSITORIA_CREDITOS.code, name: TRANSITORIA_CREDITOS.name },
                        value: absAmount
                    }],
                    reasoning: absAmount >= 50000 
                        ? `Valor alto (R$ ${absAmount.toLocaleString('pt-BR')}). Verificar se é empréstimo de sócio ou aporte.`
                        : `Padrão de nome de sócio detectado. Verificar se é empréstimo ou aporte.`,
                    suggested_accounts: [
                        { id: '', code: '2.1.2.03', name: 'Empréstimos de Sócios (Passivo)' },
                        { id: '', code: '2.4.1.01', name: 'Adiant. Futuro Aumento Capital (PL)' },
                        { id: '', code: '1.1.2.01', name: 'Clientes a Receber (se for honorário)' }
                    ]
                };
            }
            
            // Detectar transferência entre contas
            if (descUpper.includes('TRANSF') && descUpper.includes('AMPLA')) {
                return {
                    description: "Transferência entre contas",
                    type: "transfer",
                    requires_review: true,
                    entries: [{
                        debit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        credit: { account: TRANSITORIA_CREDITOS.code, name: TRANSITORIA_CREDITOS.name },
                        value: absAmount
                    }],
                    reasoning: "Transferência interna detectada. Classificar para outra conta bancária.",
                    suggested_accounts: [
                        { id: '', code: '1.1.1.01', name: 'Caixa Geral' },
                        { id: '', code: '1.1.1.xx', name: 'Outro Banco' }
                    ]
                };
            }
            
            // ========================================
            // PADRÃO: Entrada sem classificação
            // NUNCA gerar receita automaticamente!
            // ========================================
            return {
                description: "📋 PENDENTE: Entrada não classificada",
                type: "pending_classification",
                requires_review: true,
                entries: [{
                    debit: { account: bankAccountCode, name: 'Banco Sicredi' },
                    credit: { account: TRANSITORIA_CREDITOS.code, name: TRANSITORIA_CREDITOS.name },
                    value: absAmount
                }],
                reasoning: "Entrada de dinheiro registrada na conta transitória. " +
                          "CLASSIFICAÇÃO OBRIGATÓRIA: Identificar se é baixa de cliente, empréstimo, aporte ou outro. " +
                          "PIX nunca gera receita automaticamente.",
                suggested_accounts: [
                    { id: '', code: '1.1.2.01', name: 'Clientes a Receber (mais comum)' },
                    { id: '', code: '2.1.2.03', name: 'Empréstimos de Sócios' },
                    { id: '', code: '2.4.1.01', name: 'Adiant. Futuro Aumento Capital' },
                    { id: '', code: '1.1.1.xx', name: 'Transferência de outra conta' }
                ]
            };
            
        } else {
            // ========================================
            // SAÍDA DE DINHEIRO
            // ========================================
            
            // Detectar tarifas bancárias (pode classificar automaticamente)
            // Inclui:
            // - TARIFA COM R LIQUIDACAO-COB = R$ 1,89 por boleto liquidado
            // - MANUTENCAO DE TITULOS-COB = R$ 1,89 por título em carteira
            // - CESTA DE RELACIONAMENTO = pacote mensal de serviços
            const isBankFee = /\bTARIFA\b|\bPACOTE\b|\bTAXA\b|\bIOF\b|\bMANUTENCAO.*TITULO|\bCESTA.*RELACIONAMENTO/i.test(descUpper) || 
                            (descUpper.includes('LIQUIDACAO') && descUpper.includes('COB'));
            
            if (isBankFee) {
                const acc = accountingService.getExpenseAccountCode('tarifas');
                
                // Calcular explicação baseada no tipo de tarifa
                let reasoning = "Tarifa bancária identificada pelo padrão. Classificação automática permitida.";
                
                if (/TARIFA.*LIQUIDACAO.*COB/i.test(description)) {
                    const cobNum = description.match(/COB(\d+)/)?.[1] || '?';
                    const qtdBoletos = Math.round(absAmount / 1.89);
                    reasoning = `Tarifa de cobrança COB${cobNum}: R$ 1,89 × ${qtdBoletos} boletos = R$ ${absAmount.toFixed(2)}. Despesa bancária automática.`;
                } else if (/MANUTENCAO.*TITULO.*COB/i.test(description)) {
                    const cobNum = description.match(/COB(\d+)/)?.[1] || '?';
                    const qtdTitulos = Math.round(absAmount / 1.89);
                    reasoning = `Manutenção de títulos COB${cobNum}: R$ 1,89 × ${qtdTitulos} títulos em carteira = R$ ${absAmount.toFixed(2)}. Despesa bancária automática.`;
                } else if (/CESTA.*RELACIONAMENTO/i.test(description)) {
                    reasoning = `Cesta de relacionamento bancário: pacote mensal de serviços R$ ${absAmount.toFixed(2)}. Despesa bancária automática.`;
                }
                
                return {
                    description: "Tarifa Bancária (auto-classificável)",
                    type: "expense_current",
                    confidence: 95,
                    requires_review: false, // Tarifas podem ser automáticas
                    entries: [{
                        debit: { account: TRANSITORIA_DEBITOS.code, name: TRANSITORIA_DEBITOS.name },
                        credit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        value: absAmount
                    }, {
                        debit: { account: acc.code, name: acc.name },
                        credit: { account: TRANSITORIA_DEBITOS.code, name: TRANSITORIA_DEBITOS.name },
                        value: absAmount
                    }],
                    reasoning
                };
            }
            
            // Detectar impostos
            const isTax = /\bDARF\b|\bGPS\b|\bINSS\b|\bFGTS\b|\bSIMPLES\b|\bDAS\b|\bISS\b/.test(descUpper);
            
            if (isTax) {
                return {
                    description: "Pagamento de Imposto/Taxa",
                    type: "expense_current",
                    confidence: 90,
                    requires_review: true,
                    entries: [{
                        debit: { account: TRANSITORIA_DEBITOS.code, name: TRANSITORIA_DEBITOS.name },
                        credit: { account: bankAccountCode, name: 'Banco Sicredi' },
                        value: absAmount
                    }],
                    reasoning: "Pagamento de tributo identificado. Verificar conta específica.",
                    suggested_accounts: [
                        { id: '', code: '2.1.3.01', name: 'ISS a Recolher' },
                        { id: '', code: '2.1.3.02', name: 'IRRF a Recolher' },
                        { id: '', code: '2.1.3.03', name: 'Simples Nacional a Pagar' }
                    ]
                };
            }
            
            // ========================================
            // PADRÃO: Saída sem classificação
            // ========================================
            return {
                description: "📋 PENDENTE: Saída não classificada",
                type: "pending_classification",
                requires_review: true,
                entries: [{
                    debit: { account: TRANSITORIA_DEBITOS.code, name: TRANSITORIA_DEBITOS.name },
                    credit: { account: bankAccountCode, name: 'Banco Sicredi' },
                    value: absAmount
                }],
                reasoning: "Saída de dinheiro registrada na conta transitória. " +
                          "CLASSIFICAÇÃO OBRIGATÓRIA: Identificar natureza da despesa ou pagamento.",
                suggested_accounts: [
                    { id: '', code: '4.1.1.01', name: 'Salários e Ordenados' },
                    { id: '', code: '4.1.2.xx', name: 'Despesas Administrativas' },
                    { id: '', code: '4.1.3.02', name: 'Tarifas Bancárias' },
                    { id: '', code: '2.1.1.01', name: 'Fornecedores a Pagar (baixa)' }
                ]
            };
        }
    }
}
