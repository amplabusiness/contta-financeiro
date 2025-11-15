import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Edge Function para atualizar automaticamente o status de invoices
 *
 * Executa diariamente (via cron ou scheduler) para:
 * 1. Marcar invoices pendentes como overdue quando vencimento passa
 * 2. Refresh cache de KPIs do dashboard
 * 3. Enviar notificações de vencimento (futuro)
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔄 Iniciando atualização de status de invoices...')

    // 1. Atualizar invoices pendentes que já venceram
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString().split('T')[0]

    const { data: overdueInvoices, error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'overdue',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'pending')
      .lt('due_date', todayISO)
      .select('id, client_id, amount, due_date')

    if (updateError) {
      console.error('❌ Erro ao atualizar invoices:', updateError)
      throw updateError
    }

    const updatedCount = overdueInvoices?.length || 0
    console.log(`✅ ${updatedCount} invoices marcadas como overdue`)

    // 2. Refresh cache de KPIs do dashboard (view materializada)
    try {
      const { error: refreshError } = await supabase.rpc('refresh_dashboard_kpis')

      if (!refreshError) {
        console.log('✅ Cache de KPIs atualizado')
      } else {
        console.warn('⚠️ Erro ao atualizar cache de KPIs:', refreshError.message)
      }
    } catch (error) {
      console.warn('⚠️ Função refresh_dashboard_kpis não disponível')
    }

    // 3. Gerar relatório de inadimplência (opcional)
    const { data: overdueStats } = await supabase
      .from('invoices')
      .select('client_id, amount')
      .eq('status', 'overdue')

    const totalOverdue = overdueStats?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0
    const clientsWithOverdue = new Set(overdueStats?.map(inv => inv.client_id)).size

    console.log(`📊 Estatísticas de inadimplência:`)
    console.log(`   - Total em atraso: R$ ${totalOverdue.toFixed(2)}`)
    console.log(`   - Clientes inadimplentes: ${clientsWithOverdue}`)

    // 4. Registrar execução no log (opcional - para auditoria)
    const executionLog = {
      executed_at: new Date().toISOString(),
      invoices_updated: updatedCount,
      total_overdue_amount: totalOverdue,
      clients_with_overdue: clientsWithOverdue
    }

    // Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          updated: updatedCount,
          totalOverdue,
          clientsWithOverdue,
          executedAt: new Date().toISOString()
        },
        log: executionLog
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: unknown) {
    console.error('❌ Erro na atualização de status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * INSTRUÇÕES DE USO:
 *
 * 1. AGENDAR EXECUÇÃO DIÁRIA (via Supabase Dashboard):
 *    - Vá em Database → Functions → Cron Jobs
 *    - Crie um novo cron job:
 *      SELECT cron.schedule(
 *        'update-invoice-status',
 *        '0 1 * * *',  -- Executa todo dia às 01:00
 *        $$
 *        SELECT net.http_post(
 *          url := 'https://YOUR-PROJECT.supabase.co/functions/v1/update-invoice-status',
 *          headers := '{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
 *          body := '{}'::jsonb
 *        ) as request_id;
 *        $$
 *      );
 *
 * 2. EXECUTAR MANUALMENTE (via curl):
 *    curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/update-invoice-status \
 *      -H "Authorization: Bearer SERVICE_ROLE_KEY" \
 *      -H "Content-Type: application/json"
 *
 * 3. EXECUTAR MANUALMENTE (via Supabase Client):
 *    const { data, error } = await supabase.functions.invoke('update-invoice-status')
 */
