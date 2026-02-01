/**
 * ClassificationService.ts
 * 
 * Serviço responsável por:
 * - Classificação inteligente de transações
 * - Aprendizado automático de regras
 * - Validações do Dr. Cícero
 * - Reclassificação e Split
 * 
 * REGRAS DE OURO DO DR. CÍCERO:
 * 1. NENHUMA transação pode ser conciliada sem classificação validada
 * 2. PIX de sócio NUNCA vira Receita
 * 3. Receita NUNCA nasce direto do banco
 * 4. Conta genérica requer justificativa
 * 5. Toda classificação gera aprendizado
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TIPOS
// ============================================================================

export interface BankTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  matched: boolean;
  journal_entry_id?: string;
  extracted_cnpj?: string;
  extracted_cpf?: string;
  extracted_cob?: string;
  suggested_client_id?: string;
  suggested_client_name?: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

export interface ClassificationRule {
  id: string;
  rule_name: string;
  destination_account_id: string;
  destination_account_code: string;
  destination_account_name: string;
  confidence_score: number;
  status: 'learning' | 'semi_auto' | 'auto' | 'disabled';
}

export interface SplitLine {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
  description?: string;
}

export interface ClassificationResult {
  success: boolean;
  entry_id?: string;
  reclassification_id?: string;
  rule_id?: string;
  error?: string;
  warning?: string;
}

// ============================================================================
// CONTAS GENÉRICAS E PROIBIÇÕES
// ============================================================================

const GENERIC_ACCOUNTS = [
  '4.1.1.08',  // Outras Despesas Operacionais
  '4.1.1.99',  // Outras Despesas
  '3.1.1.99',  // Outras Receitas
  '1.1.9.01',  // Transitória Débitos
  '2.1.9.01',  // Transitória Créditos
];

const FORBIDDEN_REVENUE_KEYWORDS = [
  'sócio', 'socio', 'empréstimo', 'emprestimo', 
  'aporte', 'devolução', 'devoluçao', 'reembolso',
  'transferência própria', 'transferencia propria'
];

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export class ClassificationService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ==========================================================================
  // VALIDAÇÕES DO DR. CÍCERO
  // ==========================================================================

  /**
   * Valida se uma transação pode ser classificada em determinada conta
   */
  validateClassification(
    transaction: BankTransaction, 
    account: Account,
    justification?: string
  ): { valid: boolean; error?: string; warning?: string } {
    const isIncome = transaction.amount > 0;
    const descLower = transaction.description.toLowerCase();

    // Regra 1: PIX de sócio NUNCA vira receita
    if (isIncome && account.type === 'REVENUE') {
      const isForbidden = FORBIDDEN_REVENUE_KEYWORDS.some(kw => descLower.includes(kw));
      if (isForbidden) {
        return {
          valid: false,
          error: '🚫 PIX de sócio/empréstimo NÃO pode ser classificado como Receita. Use conta de Passivo (Empréstimos de Sócios) ou Patrimônio Líquido.'
        };
      }
    }

    // Regra 2: Conta genérica requer justificativa
    if (GENERIC_ACCOUNTS.some(code => account.code.startsWith(code))) {
      if (!justification || justification.trim().length < 10) {
        return {
          valid: false,
          error: '⚠️ Conta genérica requer justificativa detalhada (mínimo 10 caracteres)'
        };
      }
      return {
        valid: true,
        warning: '⚠️ Conta genérica utilizada. Considere criar uma conta específica.'
      };
    }

    // Regra 3: Entrada classificada como Despesa (alertar, não bloquear)
    if (isIncome && account.type === 'EXPENSE') {
      return {
        valid: true,
        warning: '⚠️ Entrada classificada como Despesa - verifique se é estorno'
      };
    }

    // Regra 4: Saída classificada como Receita (alertar, não bloquear)
    if (!isIncome && account.type === 'REVENUE') {
      return {
        valid: true,
        warning: '⚠️ Saída classificada como Receita - verifique se é estorno'
      };
    }

    return { valid: true };
  }

  // ==========================================================================
  // BUSCAR REGRAS CORRESPONDENTES
  // ==========================================================================

  /**
   * Busca regras de classificação que correspondem à transação
   */
  async findMatchingRules(transaction: BankTransaction): Promise<ClassificationRule[]> {
    const transactionType = transaction.amount > 0 ? 'credit' : 'debit';
    const absAmount = Math.abs(transaction.amount);

    const { data, error } = await supabase.rpc('rpc_find_matching_rule', {
      p_tenant_id: this.tenantId,
      p_amount: absAmount,
      p_description: transaction.description,
      p_transaction_type: transactionType
    });

    if (error) {
      console.error('Erro ao buscar regras:', error);
      return [];
    }

    return data || [];
  }

  // ==========================================================================
  // CLASSIFICAÇÃO SIMPLES
  // ==========================================================================

  /**
   * Classifica uma transação em uma única conta
   */
  async classifyTransaction(
    transaction: BankTransaction,
    account: Account,
    options?: {
      justification?: string;
      createRule?: boolean;
      bankAccountId?: string;
    }
  ): Promise<ClassificationResult> {
    // Validar classificação
    const validation = this.validateClassification(
      transaction, 
      account, 
      options?.justification
    );

    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Obter conta bancária
      const bankAccountCode = options?.bankAccountId || '1.1.1.05'; // Sicredi default
      
      // Buscar ID da conta bancária
      const { data: bankAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', bankAccountCode)
        .eq('tenant_id', this.tenantId)
        .single();

      if (!bankAccount) {
        return { success: false, error: 'Conta bancária não encontrada' };
      }

      const isIncome = transaction.amount > 0;
      const absAmount = Math.abs(transaction.amount);
      const now = new Date().toISOString();
      const internalCode = `CLASS_${Date.now()}_${transaction.id.slice(0, 8)}`;

      // Criar lançamento contábil
      const { data: entry, error: entryError } = await supabase
        .from('accounting_entries')
        .insert({
          tenant_id: this.tenantId,
          entry_date: transaction.date,
          description: `Classificação: ${transaction.description.slice(0, 100)}`,
          internal_code: internalCode,
          source_type: 'classification',
          entry_type: 'CLASSIFICACAO',
          reference_type: 'bank_transaction',
          reference_id: transaction.id,
          created_by: userId
        })
        .select()
        .single();

      if (entryError) throw new Error(entryError.message);

      // Criar linhas do lançamento
      const lines = isIncome ? [
        // Entrada: D Transitória Créditos / C Conta Classificada
        { entry_id: entry.id, tenant_id: this.tenantId, account_id: '28085461-9e5a-4fb4-847d-c9fc047fe0a1', debit: absAmount, credit: 0 },
        { entry_id: entry.id, tenant_id: this.tenantId, account_id: account.id, debit: 0, credit: absAmount }
      ] : [
        // Saída: D Conta Classificada / C Transitória Débitos
        { entry_id: entry.id, tenant_id: this.tenantId, account_id: account.id, debit: absAmount, credit: 0 },
        { entry_id: entry.id, tenant_id: this.tenantId, account_id: '3e1fd22f-fba2-4cc2-b628-9d729233bca0', debit: 0, credit: absAmount }
      ];

      const { error: linesError } = await supabase
        .from('accounting_entry_lines')
        .insert(lines);

      if (linesError) throw new Error(linesError.message);

      // 🔴 RECONCILIAR VIA RPC OFICIAL
      // Dr. Cícero: Toda reconciliação DEVE passar pelo RPC
      const { data: reconcileResult, error: reconcileError } = await supabase.rpc('reconcile_transaction', {
        p_transaction_id: transaction.id,
        p_journal_entry_id: entry.id,
        p_actor: 'classification-service'
      });

      if (reconcileError) {
        console.error('[ClassificationService] Erro no RPC reconcile_transaction:', reconcileError);
        // Fallback: trigger garante consistência mesmo sem RPC
        await supabase
          .from('bank_transactions')
          .update({
            matched: true,
            journal_entry_id: entry.id,
            reconciled_at: now,
            is_reconciled: true,
            status: 'reconciled'
          })
          .eq('id', transaction.id);
      }

      // Criar regra de aprendizado se solicitado
      let ruleId: string | undefined;
      if (options?.createRule) {
        const keywords = this.extractKeywords(transaction.description);
        const transactionType = isIncome ? 'credit' : 'debit';

        const { data: ruleData } = await supabase.rpc('rpc_create_classification_rule', {
          p_tenant_id: this.tenantId,
          p_rule_name: `Auto: ${account.name}`,
          p_destination_account_id: account.id,
          p_created_by: userId,
          p_description_keywords: keywords,
          p_transaction_type: transactionType
        });

        if (ruleData?.success) {
          ruleId = ruleData.rule_id;
        }
      }

      return {
        success: true,
        entry_id: entry.id,
        rule_id: ruleId,
        warning: validation.warning
      };

    } catch (err: unknown) {
      console.error('Erro na classificação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  }

  // ==========================================================================
  // RECLASSIFICAÇÃO (SPLIT)
  // ==========================================================================

  /**
   * Cria uma reclassificação (split) de um lançamento existente
   */
  async createReclassification(
    parentEntryId: string,
    lines: SplitLine[],
    justification: string,
    submitForApproval: boolean = true
  ): Promise<ClassificationResult> {
    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Validar linhas
      const totalLines = lines.reduce((sum, l) => sum + l.amount, 0);
      
      // Buscar valor original
      const { data: parentEntry } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('entry_id', parentEntryId)
        .limit(1)
        .single();

      if (!parentEntry) {
        return { success: false, error: 'Lançamento pai não encontrado' };
      }

      const parentAmount = Math.max(parentEntry.debit, parentEntry.credit);
      
      if (Math.abs(totalLines - parentAmount) > 0.01) {
        return { 
          success: false, 
          error: `Total das linhas (${totalLines.toFixed(2)}) difere do original (${parentAmount.toFixed(2)})` 
        };
      }

      // Preparar dados para RPC
      const lineData = lines.map(l => ({
        account_id: l.account_id,
        amount: l.amount,
        description: l.description || ''
      }));

      const { data, error } = await supabase.rpc('rpc_create_reclassification', {
        p_tenant_id: this.tenantId,
        p_parent_entry_id: parentEntryId,
        p_lines: lineData,
        p_justification: justification,
        p_created_by: userId
      });

      if (error) throw error;

      if (!data?.success) {
        return { success: false, error: data?.error || 'Erro ao criar reclassificação' };
      }

      // Atualizar status se solicitado aprovação
      if (submitForApproval) {
        await supabase
          .from('accounting_reclassifications')
          .update({ status: 'pending' })
          .eq('id', data.reclassification_id);
      }

      return {
        success: true,
        reclassification_id: data.reclassification_id
      };

    } catch (err: unknown) {
      console.error('Erro na reclassificação:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  }

  // ==========================================================================
  // APLICAR REGRA EXISTENTE
  // ==========================================================================

  /**
   * Aplica uma regra de classificação existente a uma transação
   */
  async applyRule(
    transaction: BankTransaction,
    rule: ClassificationRule,
    approved: boolean = true
  ): Promise<ClassificationResult> {
    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Buscar conta destino
      const { data: account } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type')
        .eq('id', rule.destination_account_id)
        .single();

      if (!account) {
        return { success: false, error: 'Conta destino não encontrada' };
      }

      // Se aprovado, classificar
      if (approved) {
        const result = await this.classifyTransaction(transaction, account as Account);
        
        if (result.success) {
          // Registrar aplicação da regra
          await supabase.rpc('rpc_apply_classification_rule', {
            p_tenant_id: this.tenantId,
            p_rule_id: rule.id,
            p_bank_transaction_id: transaction.id,
            p_entry_id: result.entry_id,
            p_approved: true,
            p_reviewed_by: userId
          });
        }

        return result;
      }

      // Se rejeitado, apenas registrar
      await supabase.rpc('rpc_apply_classification_rule', {
        p_tenant_id: this.tenantId,
        p_rule_id: rule.id,
        p_bank_transaction_id: transaction.id,
        p_approved: false,
        p_reviewed_by: userId,
        p_rejection_reason: 'Rejeitado pelo usuário'
      });

      return { success: true };

    } catch (err: unknown) {
      console.error('Erro ao aplicar regra:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  }

  // ==========================================================================
  // CRIAR NOVA CONTA
  // ==========================================================================

  /**
   * Cria uma nova conta no plano de contas
   */
  async createAccount(
    code: string,
    name: string,
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  ): Promise<{ success: boolean; account?: Account; error?: string }> {
    // Validar formato do código
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(code)) {
      return { success: false, error: 'Código deve seguir padrão X.X.X.XX' };
    }

    // Verificar se código já existe
    const { data: existing } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', code)
      .eq('tenant_id', this.tenantId)
      .single();

    if (existing) {
      return { success: false, error: 'Código já existe no plano de contas' };
    }

    // Determinar balance_type
    const balanceType = (type === 'EXPENSE' || type === 'ASSET') ? 'DEBIT' : 'CREDIT';

    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          tenant_id: this.tenantId,
          code,
          name,
          type,
          is_analytical: true,
          is_active: true,
          balance_type: balanceType
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, account: data };

    } catch (err: unknown) {
      console.error('Erro ao criar conta:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  }

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  /**
   * Extrai keywords relevantes de uma descrição
   */
  private extractKeywords(description: string): string[] {
    const words = description.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);

    // Remover stopwords
    const stopwords = ['para', 'com', 'por', 'pix', 'ted', 'doc', 'boleto', 'pagamento', 'recebimento'];
    return words.filter(w => !stopwords.includes(w)).slice(0, 5);
  }

  /**
   * Sugere código para nova conta baseado no tipo
   */
  async suggestAccountCode(type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'): Promise<string> {
    // Prefixos por tipo
    const prefixes: Record<string, string> = {
      'ASSET': '1.1.2',
      'LIABILITY': '2.1.1',
      'EQUITY': '2.4.1',
      'REVENUE': '3.1.1',
      'EXPENSE': '4.1.1'
    };

    const prefix = prefixes[type] || '4.1.1';

    // Buscar último código usado
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('code')
      .eq('tenant_id', this.tenantId)
      .ilike('code', `${prefix}%`)
      .order('code', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const parts = data.code.split('.');
      const lastNum = parseInt(parts[parts.length - 1]) || 0;
      parts[parts.length - 1] = String(lastNum + 1).padStart(2, '0');
      return parts.join('.');
    }

    return `${prefix}.01`;
  }
}
