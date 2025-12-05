import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook de Auto-Manutenção Contábil com IA
 *
 * Executa automaticamente no startup da aplicação:
 * 1. Chama o AI Orchestrator para verificação completa
 * 2. Processa dados pendentes
 * 3. Limpa dados inconsistentes
 * 4. Gera despesas recorrentes automaticamente
 * 5. Gera boletos para clientes
 * 6. Verifica contratos faltantes
 * 7. Gera distratos para empresas suspensas/inativas
 *
 * O usuário nunca precisa saber que isso está acontecendo.
 * Tudo funciona magicamente em background.
 */

const HEALTH_CHECK_KEY = 'accounting_health_check_last';
const AUTOMATION_CHECK_KEY = 'automation_check_last';
const ACCOUNTING_CYCLE_KEY = 'accounting_cycle_last';
const HEALTH_CHECK_INTERVAL = 1000 * 60 * 30; // 30 minutos entre verificações
const AUTOMATION_INTERVAL = 1000 * 60 * 60 * 6; // 6 horas entre automações
const ACCOUNTING_CYCLE_INTERVAL = 1000 * 60 * 60 * 12; // 12 horas entre ciclos contábeis

export function useAccountingHealth() {
  const hasRun = useRef(false);

  useEffect(() => {
    // Evitar múltiplas execuções
    if (hasRun.current) return;
    hasRun.current = true;

    // Verificar se já rodou recentemente
    const lastCheck = localStorage.getItem(HEALTH_CHECK_KEY);
    const now = Date.now();

    if (lastCheck && (now - parseInt(lastCheck)) < HEALTH_CHECK_INTERVAL) {
      console.log('[AccountingHealth] Skipping - checked recently');
      return;
    }

    // Executar verificação em background
    runHealthCheck();

    // Executar automações (em paralelo, menos frequente)
    runAutomations();

    // Executar ciclo contábil completo (Livro Diário, Razão, Balancete)
    runAccountingCycle();
  }, []);
}

async function runHealthCheck() {
  console.log('[AccountingHealth] Starting automatic health check with AI Orchestrator...');

  try {
    // Tentar usar o AI Orchestrator primeiro (mais inteligente)
    try {
      const { data, error } = await supabase.functions.invoke('ai-orchestrator', {
        body: { action: 'full_health_check' }
      });

      if (!error && data?.success) {
        console.log('[AccountingHealth] AI Orchestrator completed:', data);
        localStorage.setItem(HEALTH_CHECK_KEY, Date.now().toString());
        return;
      }
    } catch (orchestratorError) {
      console.debug('[AccountingHealth] AI Orchestrator not available, falling back to manual check...', orchestratorError);
    }

    // Fallback para verificação manual se o orquestrador falhar
    console.log('[AccountingHealth] Falling back to manual check...');

    // 1. Verificar e limpar órfãos silenciosamente
    await cleanupOrphans();

    // 2. Garantir que plano de contas existe
    await ensureChartOfAccounts();

    // 3. Processar dados pendentes
    await processPendingData();

    // Marcar como verificado
    localStorage.setItem(HEALTH_CHECK_KEY, Date.now().toString());
    console.log('[AccountingHealth] Health check completed successfully');

  } catch (error) {
    console.debug('[AccountingHealth] Error during health check (non-critical):', error);
    // Background health checks are non-critical, so we fail silently
    // Mark as checked to prevent repeated attempts
    localStorage.setItem(HEALTH_CHECK_KEY, Date.now().toString());
  }
}

async function cleanupOrphans() {
  try {
    // Contar entries e lines
    const [entriesResult, linesResult] = await Promise.all([
      supabase.from('accounting_entries').select('id', { count: 'exact', head: true }),
      supabase.from('accounting_entry_lines').select('entry_id', { count: 'exact', head: true })
    ]);

    const entriesCount = entriesResult.count || 0;
    const linesCount = linesResult.count || 0;

    // Se tem entries mas não tem lines, limpar
    if (entriesCount > 0 && linesCount === 0) {
      console.log(`[AccountingHealth] Found ${entriesCount} orphan entries, cleaning up...`);

      try {
        const { error } = await supabase.functions.invoke('smart-accounting', {
          body: { action: 'cleanup_orphans' }
        });

        if (error) {
          console.debug('[AccountingHealth] Cleanup function error (non-critical):', error);
        } else {
          console.log('[AccountingHealth] Orphan entries cleaned');
        }
      } catch (funcError) {
        console.debug('[AccountingHealth] Cleanup function not available:', funcError);
      }
    } else if (entriesCount > 0 && linesCount > 0) {
      // Verificar se há órfãos específicos
      const { data: entriesWithLines } = await supabase
        .from('accounting_entry_lines')
        .select('entry_id');

      const validIds = new Set((entriesWithLines || []).map(e => e.entry_id));

      const { data: allEntries } = await supabase
        .from('accounting_entries')
        .select('id');

      const orphanCount = (allEntries || []).filter(e => !validIds.has(e.id)).length;

      if (orphanCount > 0) {
        console.log(`[AccountingHealth] Found ${orphanCount} orphan entries, cleaning up...`);
        try {
          await supabase.functions.invoke('smart-accounting', {
            body: { action: 'cleanup_orphans' }
          });
        } catch (funcError) {
          console.debug('[AccountingHealth] Cleanup function not available:', funcError);
        }
      }
    }
  } catch (error) {
    console.debug('[AccountingHealth] Error checking orphans (non-critical):', error);
  }
}

async function ensureChartOfAccounts() {
  try {
    const { count } = await supabase
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true });

    if (!count || count === 0) {
      console.log('[AccountingHealth] Initializing chart of accounts...');

      try {
        await supabase.functions.invoke('smart-accounting', {
          body: { action: 'init_chart' }
        });

        console.log('[AccountingHealth] Chart of accounts initialized');
      } catch (funcError) {
        console.debug('[AccountingHealth] Init chart function not available:', funcError);
      }
    }
  } catch (error) {
    console.debug('[AccountingHealth] Error ensuring chart of accounts (non-critical):', error);
  }
}

async function processPendingData() {
  try {
    // Verificar se há dados sem lançamento contábil
    const { data: invoicesWithoutEntry } = await supabase
      .from('invoices')
      .select('id')
      .limit(1);

    const { data: existingEntries } = await supabase
      .from('accounting_entries')
      .select('reference_id')
      .eq('reference_type', 'invoice')
      .limit(1);

    // Se tem invoices mas não tem entries, processar retroativamente
    if (invoicesWithoutEntry?.length && !existingEntries?.length) {
      console.log('[AccountingHealth] Processing pending invoices...');

      try {
        await supabase.functions.invoke('smart-accounting', {
          body: { action: 'generate_retroactive', table: 'invoices' }
        });
      } catch (funcError) {
        console.debug('[AccountingHealth] Generate retroactive function not available:', funcError);
      }
    }

    // Verificar saldos de abertura
    const { data: balancesWithoutEntry } = await supabase
      .from('client_opening_balance')
      .select('id')
      .limit(1);

    const { data: existingBalanceEntries } = await supabase
      .from('accounting_entries')
      .select('reference_id')
      .eq('reference_type', 'opening_balance')
      .limit(1);

    if (balancesWithoutEntry?.length && !existingBalanceEntries?.length) {
      console.log('[AccountingHealth] Processing pending opening balances...');

      try {
        await supabase.functions.invoke('smart-accounting', {
          body: { action: 'generate_retroactive', table: 'client_opening_balance' }
        });
      } catch (funcError) {
        console.debug('[AccountingHealth] Generate retroactive function not available:', funcError);
      }
    }

  } catch (error) {
    console.debug('[AccountingHealth] Error processing pending data (non-critical):', error);
  }
}

/**
 * Executa automações inteligentes com IA
 * - Despesas recorrentes
 * - Geração de boletos
 * - Contratos faltantes
 * - Distratos automáticos
 */
async function runAutomations() {
  const lastAutomation = localStorage.getItem(AUTOMATION_CHECK_KEY);
  const now = Date.now();

  // Verificar se já rodou recentemente (6 horas)
  if (lastAutomation && (now - parseInt(lastAutomation)) < AUTOMATION_INTERVAL) {
    console.log('[Automation] Skipping - ran recently');
    return;
  }

  console.log('[Automation] Starting AI-powered automations...');

  try {
    // Chamar o agente de automação
    try {
      const { data, error } = await supabase.functions.invoke('ai-automation-agent', {
        body: { action: 'full_automation' }
      });

      if (error) {
        console.debug('[Automation] Error from function:', error);
        // Mark as checked even if function failed, to prevent repeated attempts
        localStorage.setItem(AUTOMATION_CHECK_KEY, now.toString());
        return;
      }

      console.log('[Automation] Completed:', data);

      // Logar resultados
      if (data?.recurring_expenses?.generated > 0) {
        console.log(`[Automation] Generated ${data.recurring_expenses.generated} recurring expenses`);
      }
      if (data?.invoices?.generated > 0) {
        console.log(`[Automation] Generated ${data.invoices.generated} invoices`);
      }
      if (data?.contracts?.generated > 0) {
        console.log(`[Automation] Generated ${data.contracts.generated} contracts`);
      }
      if (data?.company_status?.generated > 0) {
        console.log(`[Automation] Generated ${data.company_status.generated} distracts`);
      }

      // Marcar como executado
      localStorage.setItem(AUTOMATION_CHECK_KEY, now.toString());
    } catch (funcError) {
      console.debug('[Automation] Function not available or network error:', funcError);
      // Mark as checked to prevent repeated attempts
      localStorage.setItem(AUTOMATION_CHECK_KEY, now.toString());
    }

  } catch (error) {
    console.debug('[Automation] Error during automation setup (non-critical):', error);
    // Mark as checked to prevent repeated attempts
    localStorage.setItem(AUTOMATION_CHECK_KEY, now.toString());
  }
}

/**
 * Força uma verificação de saúde manual (para uso em casos específicos)
 */
export async function forceHealthCheck() {
  localStorage.removeItem(HEALTH_CHECK_KEY);
  await runHealthCheck();
}

/**
 * Força execução das automações (para uso em casos específicos)
 */
export async function forceAutomations() {
  localStorage.removeItem(AUTOMATION_CHECK_KEY);
  await runAutomations();
}

/**
 * Executa ciclo contábil completo com IA
 * - Processa lançamentos pendentes no Livro Diário
 * - Atualiza Razão Contábil
 * - Gera Balancete mensal
 * - Provisiona honorários
 * - Em 31/12: Fecha exercício e gera Balanço
 */
async function runAccountingCycle() {
  const lastCycle = localStorage.getItem(ACCOUNTING_CYCLE_KEY);
  const now = Date.now();

  // Verificar se já rodou recentemente (12 horas)
  if (lastCycle && (now - parseInt(lastCycle)) < ACCOUNTING_CYCLE_INTERVAL) {
    console.log('[AccountingCycle] Skipping - ran recently');
    return;
  }

  console.log('[AccountingCycle] Starting AI-powered accounting cycle...');

  try {
    // Chamar o motor contábil
    try {
      const { data, error } = await supabase.functions.invoke('ai-accounting-engine', {
        body: { action: 'full_accounting_cycle' }
      });

      if (error) {
        console.debug('[AccountingCycle] Error from function:', error);
        // Mark as checked even if function failed, to prevent repeated attempts
        localStorage.setItem(ACCOUNTING_CYCLE_KEY, now.toString());
        return;
      }

      console.log('[AccountingCycle] Completed:', data);

      // Logar resultados
      if (data?.pending?.invoices?.processed > 0) {
        console.log(`[AccountingCycle] Processed ${data.pending.invoices.processed} invoices to journal`);
      }
      if (data?.pending?.expenses?.processed > 0) {
        console.log(`[AccountingCycle] Processed ${data.pending.expenses.processed} expenses to journal`);
      }
      if (data?.provisions?.provisioned > 0) {
        console.log(`[AccountingCycle] Provisioned ${data.provisions.provisioned} monthly fees`);
      }
      if (data?.trialBalance?.success) {
        console.log(`[AccountingCycle] Trial balance generated: ${data.trialBalance.accounts_count} accounts`);
      }
      if (data?.yearClose?.success) {
        console.log(`[AccountingCycle] Fiscal year closed! Result: R$ ${data.yearClose.net_result}`);
      }

      // Marcar como executado
      localStorage.setItem(ACCOUNTING_CYCLE_KEY, now.toString());
    } catch (funcError) {
      console.debug('[AccountingCycle] Function not available or network error:', funcError);
      // Mark as checked to prevent repeated attempts
      localStorage.setItem(ACCOUNTING_CYCLE_KEY, now.toString());
    }

  } catch (error) {
    console.debug('[AccountingCycle] Error during cycle setup (non-critical):', error);
    // Mark as checked to prevent repeated attempts
    localStorage.setItem(ACCOUNTING_CYCLE_KEY, now.toString());
  }
}

/**
 * Força execução do ciclo contábil (para uso em casos específicos)
 */
export async function forceAccountingCycle() {
  localStorage.removeItem(ACCOUNTING_CYCLE_KEY);
  await runAccountingCycle();
}
