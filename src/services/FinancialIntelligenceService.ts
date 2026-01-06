import { supabase } from "@/integrations/supabase/client";
import { accountingService } from "@/services/AccountingService";

// Tipos
export interface OpeningBalance {
    clientId: string;
    clientName: string;
    totalAmount: number;
    accountingEntryId: string;
}

export interface ClassificationSuggestion {
    description: string;
    type: 'revenue_current' | 'revenue_past' | 'expense_current' | 'split';
    entries: {
        debit: { account: string; name: string };
        credit: { account: string; name: string };
        value: number;
    }[];
    reasoning: string;
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
             const { data } = await supabase.from('intelligence_rules').select('*');
             if (!data) return null;

             // Ordena por especificidade (match mais longo vence) -> opcional
             const match = data.find(rule => description.toUpperCase().includes(rule.pattern.toUpperCase()));
             if (match) {
                 await supabase.rpc('increment_rule_usage', { rule_id: match.id }).catch(() => {}); // Opcional
                 return { code: match.account_code, name: match.account_name || 'Conta Aprendida' };
             }
         } catch (e) {
             console.warn("Dr. Cicero (Memória): Tabela de regras não encontrada ou vazia.");
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
     */
    async analyzeBankTransaction(
        amount: number, 
        date: string, 
        description: string,
        bankAccountCode: string = "1.1.1.01" // Fallback seguro (Caixa) se não informado
    ): Promise<ClassificationSuggestion> {
        const transactionDate = new Date(date);
        const isReceipt = amount > 0;
        
        // 0. Memória Muscular (Dr. Cicero Auto-Learn)
        const learnedRule = await this.findRule(description);
        if (learnedRule) {
             if (isReceipt) {
                return {
                    description: `Recebimento: ${learnedRule.name}`,
                    type: "revenue_current",
                    entries: [{
                        debit: { account: bankAccountCode, name: 'Banco' },
                        credit: { account: learnedRule.code, name: learnedRule.name },
                        value: amount
                    }],
                    reasoning: `Identificado padrão aprendido: "${learnedRule.name}"`
                };
             } else {
                return {
                    description: `Pagamento: ${learnedRule.name}`,
                    type: "expense_current",
                    entries: [{
                        debit: { account: learnedRule.code, name: learnedRule.name },
                        credit: { account: bankAccountCode, name: 'Banco' },
                        value: Math.abs(amount)
                    }],
                    reasoning: `Identificado padrão aprendido: "${learnedRule.name}"`
                };
             }
        }

        if (isReceipt) {
            // RECEBIMENTO
            
            // 1. Verificar se é um agrupamento (Lote)
            if (description.toUpperCase().includes("LOTE") || description.toUpperCase().includes("LIQUIDACAO")) {
                return {
                    description: "Recebimento em Lote",
                    type: "split",
                    entries: [],
                    reasoning: "Transação de alto valor identificada como LOTE. Necessário arquivo de detalhamento."
                };
            }

            // 2. Verificar Competência (Dr. Cicero Regra de Corte)
            const is2025 = transactionDate.getFullYear() >= 2025;

            if (is2025) {
                return {
                    description: "Recebimento de Honorários (Competência Corrente)",
                    type: "revenue_current",
                    entries: [{
                        debit: { account: bankAccountCode, name: 'Banco' },
                        credit: { account: '1.1.2.01', name: 'Clientes a Receber' },
                        value: amount
                    }],
                    reasoning: "Data em 2025. Assume-se recebimento de provisão corrente."
                };
            } else {
                return {
                    description: "Recebimento de Exercício Anterior",
                    type: "revenue_past",
                    entries: [{
                        debit: { account: bankAccountCode, name: 'Banco' },
                        credit: { account: '1.1.2.01', name: 'Clientes a Receber' },
                        value: amount
                    }],
                    reasoning: "Possível recebimento de dívida antiga."
                };
            }

        } else {
            // PAGAMENTO (Despesa)
            // Tenta adivinhar categoria pelo nome
            let expenseAccount = '';
            let expenseName = 'Selecione a Conta';
            
            // Exemplo simples de classificação (o ideal seria buscar do banco ou usar IA)
            const descUpper = (description || '').toUpperCase();
            const isBankFee = /\bTARIFA\b|\bPACOTE\b|\bTAXA\b/.test(descUpper) || descUpper.includes("LIQUIDACAO");

            if (isBankFee) {
                 const acc = accountingService.getExpenseAccountCode('tarifas'); // 4.1.3.02 Tarifa Bancária
                 expenseAccount = acc.code;
                 expenseName = acc.name;

                 // Ensina regra específica para futuras ocorrências
                 const basePattern = descUpper.includes('LIQUIDACAO') ? 'TARIFA LIQUIDACAO COBRANCA' : 'TARIFA BANCARIA';
                 await this.learnRule(basePattern, acc.code, acc.name, 'debit').catch(() => {});
            }

            return {
                description: expenseAccount ? "Pagamento de Despesa (Automático)" : "Pagamento de Despesa (A Classificar)",
                type: "expense_current",
                entries: [{
                    debit: { account: expenseAccount, name: expenseName }, 
                    credit: { account: bankAccountCode, name: 'Banco' },
                    value: Math.abs(amount)
                }],
                reasoning: expenseAccount ? "Classificado por palavra-chave." : "Pagamento realizado. Necessário classificar a despesa."
            };
        }
    }
}
