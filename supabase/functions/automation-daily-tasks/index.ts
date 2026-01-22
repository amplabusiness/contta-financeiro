import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Automation Daily Tasks
 *
 * Edge Function que executa tarefas diárias de automação:
 * - Identificação de pagadores pendentes
 * - Atualização de projeções de fluxo de caixa
 * - Geração de alertas
 * - Tentativa de fechamento mensal automático
 * - Envio de lembretes de cobrança
 */

interface TaskResult {
  task: string;
  status: 'success' | 'failed' | 'skipped';
  processed?: number;
  errors?: number;
  duration_ms?: number;
  details?: any;
}

interface DailyTasksResult {
  success: boolean;
  execution_date: string;
  tenant_id: string;
  tasks: TaskResult[];
  total_duration_ms: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { tenant_id, tasks } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[DailyTasks] Iniciando tarefas para tenant: ${tenant_id}`);

    const results: DailyTasksResult = {
      success: true,
      execution_date: new Date().toISOString(),
      tenant_id,
      tasks: [],
      total_duration_ms: 0
    };

    // Lista de tarefas padrão
    const defaultTasks = [
      'identify_pending_payers',
      'process_pending_reconciliations',
      'update_cash_flow_projections',
      'generate_daily_alerts',
      'check_monthly_close',
      'send_payment_reminders'
    ];

    const tasksToRun = tasks || defaultTasks;

    for (const taskName of tasksToRun) {
      const taskStart = Date.now();
      let taskResult: TaskResult = {
        task: taskName,
        status: 'skipped'
      };

      try {
        switch (taskName) {
          case 'identify_pending_payers':
            taskResult = await identifyPendingPayers(supabase, tenant_id);
            break;

          case 'process_pending_reconciliations':
            taskResult = await processPendingReconciliations(supabase, tenant_id);
            break;

          case 'update_cash_flow_projections':
            taskResult = await updateCashFlowProjections(supabase, tenant_id);
            break;

          case 'generate_daily_alerts':
            taskResult = await generateDailyAlerts(supabase, tenant_id);
            break;

          case 'check_monthly_close':
            taskResult = await checkMonthlyClose(supabase, tenant_id);
            break;

          case 'send_payment_reminders':
            taskResult = await sendPaymentReminders(supabase, tenant_id);
            break;

          default:
            taskResult = { task: taskName, status: 'skipped', details: 'Tarefa não reconhecida' };
        }
      } catch (error) {
        console.error(`[DailyTasks] Erro na tarefa ${taskName}:`, error);
        taskResult = {
          task: taskName,
          status: 'failed',
          details: error instanceof Error ? error.message : 'Erro desconhecido'
        };
        results.success = false;
      }

      taskResult.duration_ms = Date.now() - taskStart;
      results.tasks.push(taskResult);
    }

    results.total_duration_ms = Date.now() - startTime;

    // Registrar execução no banco
    await supabase.from('automation_pipeline_runs').insert({
      run_type: 'daily_tasks',
      status: results.success ? 'completed' : 'partial',
      processed: results.tasks.filter(t => t.status === 'success').length,
      failed: results.tasks.filter(t => t.status === 'failed').length,
      duration_ms: results.total_duration_ms,
      metadata: { tasks: results.tasks },
      tenant_id
    });

    console.log(`[DailyTasks] Concluído em ${results.total_duration_ms}ms`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DailyTasks] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Identificar pagadores pendentes usando SQL function
 */
async function identifyPendingPayers(supabase: any, tenantId: string): Promise<TaskResult> {
  const { data, error } = await supabase.rpc('fn_identify_payers_batch', {
    p_tenant_id: tenantId,
    p_limit: 100
  });

  if (error) throw error;

  return {
    task: 'identify_pending_payers',
    status: 'success',
    processed: data?.processed || 0,
    details: data
  };
}

/**
 * Processar conciliações pendentes
 */
async function processPendingReconciliations(supabase: any, tenantId: string): Promise<TaskResult> {
  // Buscar transações com alta confiança que ainda não foram conciliadas
  const { data: pending, error: fetchError } = await supabase
    .from('bank_transactions')
    .select('id, amount, suggested_client_id, identification_confidence')
    .eq('tenant_id', tenantId)
    .eq('matched', false)
    .gte('identification_confidence', 90)
    .not('suggested_client_id', 'is', null)
    .limit(50);

  if (fetchError) throw fetchError;

  let reconciled = 0;
  let failed = 0;

  for (const tx of pending || []) {
    try {
      // Buscar cliente e sua conta contábil
      const { data: client } = await supabase
        .from('clients')
        .select('id, name, accounting_account_id')
        .eq('id', tx.suggested_client_id)
        .single();

      if (!client?.accounting_account_id) {
        failed++;
        continue;
      }

      // Marcar como conciliada
      await supabase
        .from('bank_transactions')
        .update({
          matched: true,
          auto_matched: true,
          reconciled_at: new Date().toISOString(),
          reconciliation_method: 'auto_daily_task'
        })
        .eq('id', tx.id);

      reconciled++;
    } catch {
      failed++;
    }
  }

  return {
    task: 'process_pending_reconciliations',
    status: 'success',
    processed: reconciled,
    errors: failed,
    details: { total_pending: pending?.length || 0 }
  };
}

/**
 * Atualizar projeções de fluxo de caixa
 */
async function updateCashFlowProjections(supabase: any, tenantId: string): Promise<TaskResult> {
  // Calcular projeções para os próximos 30 dias
  const today = new Date();
  const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Recebíveis esperados
  const { data: receivables } = await supabase
    .from('invoices')
    .select('amount, due_date')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'overdue'])
    .lte('due_date', next30Days.toISOString().split('T')[0]);

  // Pagáveis esperados
  const { data: payables } = await supabase
    .from('accounts_payable')
    .select('amount, due_date')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .lte('due_date', next30Days.toISOString().split('T')[0]);

  const totalReceivables = (receivables || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);
  const totalPayables = (payables || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  // Atualizar cache de projeções (se existir tabela)
  // Por agora, apenas retornar as estatísticas
  return {
    task: 'update_cash_flow_projections',
    status: 'success',
    details: {
      period_days: 30,
      total_receivables: totalReceivables,
      total_payables: totalPayables,
      net_projection: totalReceivables - totalPayables,
      receivables_count: receivables?.length || 0,
      payables_count: payables?.length || 0
    }
  };
}

/**
 * Gerar alertas diários
 */
async function generateDailyAlerts(supabase: any, tenantId: string): Promise<TaskResult> {
  let alertsCreated = 0;

  // Alertas de transações não conciliadas há mais de 3 dias
  const { data: oldPending } = await supabase
    .from('bank_transactions')
    .select('id, amount, description, transaction_date')
    .eq('tenant_id', tenantId)
    .eq('matched', false)
    .gt('amount', 0)
    .lt('transaction_date', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

  for (const tx of oldPending || []) {
    const { error } = await supabase
      .from('system_alerts')
      .upsert({
        alert_type: 'reconciliation_pending',
        severity: new Date(tx.transaction_date) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? 'critical' : 'warning',
        title: `Transação não conciliada: R$ ${tx.amount}`,
        description: tx.description?.substring(0, 100),
        entity_type: 'bank_transaction',
        entity_id: tx.id,
        action_url: `/bank-reconciliation?highlight=${tx.id}`,
        tenant_id: tenantId,
        is_resolved: false
      }, {
        onConflict: 'entity_id,alert_type'
      });

    if (!error) alertsCreated++;
  }

  // Alertas de faturas vencidas
  const { data: overdueInvoices } = await supabase
    .from('invoices')
    .select('id, amount, due_date, client_id, clients(name)')
    .eq('tenant_id', tenantId)
    .eq('status', 'overdue')
    .lt('due_date', new Date().toISOString().split('T')[0]);

  for (const inv of overdueInvoices || []) {
    const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (24 * 60 * 60 * 1000));

    const { error } = await supabase
      .from('system_alerts')
      .upsert({
        alert_type: 'invoice_overdue',
        severity: daysOverdue > 30 ? 'critical' : daysOverdue > 7 ? 'warning' : 'info',
        title: `Fatura vencida: ${(inv.clients as any)?.name} - R$ ${inv.amount}`,
        description: `Vencida há ${daysOverdue} dias`,
        entity_type: 'invoice',
        entity_id: inv.id,
        action_url: `/invoices?id=${inv.id}`,
        tenant_id: tenantId,
        is_resolved: false
      }, {
        onConflict: 'entity_id,alert_type'
      });

    if (!error) alertsCreated++;
  }

  return {
    task: 'generate_daily_alerts',
    status: 'success',
    processed: alertsCreated,
    details: {
      pending_transactions_alerts: oldPending?.length || 0,
      overdue_invoices_alerts: overdueInvoices?.length || 0
    }
  };
}

/**
 * Verificar se pode fechar o mês anterior
 */
async function checkMonthlyClose(supabase: any, tenantId: string): Promise<TaskResult> {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const period = `${String(lastMonth.getMonth() + 1).padStart(2, '0')}/${lastMonth.getFullYear()}`;

  // Verificar se já está fechado
  const { data: existing } = await supabase
    .from('monthly_closings')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .single();

  if (existing?.status === 'closed') {
    return {
      task: 'check_monthly_close',
      status: 'success',
      details: { period, already_closed: true }
    };
  }

  // Verificar pendências
  const { data: pendingCheck } = await supabase.rpc('fn_check_month_pending', {
    p_period: period,
    p_tenant_id: tenantId
  });

  if (pendingCheck?.can_close) {
    // Tentar fechar automaticamente
    const { data: closeResult } = await supabase.rpc('fn_close_month', {
      p_period: period,
      p_force: false,
      p_user_id: null
    });

    return {
      task: 'check_monthly_close',
      status: closeResult?.success ? 'success' : 'failed',
      details: closeResult
    };
  }

  return {
    task: 'check_monthly_close',
    status: 'success',
    details: {
      period,
      can_close: false,
      blocking_reasons: pendingCheck?.blocking_reasons
    }
  };
}

/**
 * Enviar lembretes de pagamento
 */
async function sendPaymentReminders(supabase: any, tenantId: string): Promise<TaskResult> {
  // Buscar faturas vencendo nos próximos 3 dias ou já vencidas
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const today = new Date();

  const { data: upcomingInvoices } = await supabase
    .from('invoices')
    .select(`
      id, amount, due_date,
      clients(id, name, email, whatsapp)
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'overdue'])
    .lte('due_date', threeDaysFromNow.toISOString().split('T')[0])
    .order('due_date', { ascending: true });

  let remindersQueued = 0;

  for (const inv of upcomingInvoices || []) {
    const client = inv.clients as any;
    if (!client?.email && !client?.whatsapp) continue;

    const dueDate = new Date(inv.due_date);
    const isOverdue = dueDate < today;

    // Criar notificação na fila
    const { error } = await supabase
      .from('notification_queue')
      .insert({
        type: isOverdue ? 'payment_overdue' : 'payment_reminder',
        recipient_type: 'client',
        recipient_id: client.id,
        recipient_email: client.email,
        recipient_phone: client.whatsapp,
        subject: isOverdue
          ? `Fatura vencida - ${client.name}`
          : `Lembrete de vencimento - ${client.name}`,
        content: {
          invoice_id: inv.id,
          amount: inv.amount,
          due_date: inv.due_date,
          days_overdue: isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0
        },
        tenant_id: tenantId,
        status: 'pending'
      });

    if (!error) remindersQueued++;
  }

  return {
    task: 'send_payment_reminders',
    status: 'success',
    processed: remindersQueued,
    details: {
      total_invoices_checked: upcomingInvoices?.length || 0
    }
  };
}
