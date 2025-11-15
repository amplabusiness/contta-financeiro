import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getErrorMessage } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('⏰ Automation Scheduler started');

    const results: any = {
      timestamp: new Date().toISOString(),
      tasks: []
    };

    // 1. Executar conciliação automática
    console.log('🤖 Running AI Reconciliation...');
    try {
      const { data: reconciliationResult } = await supabase.functions.invoke('ai-reconciliation-agent');
      results.tasks.push({
        name: 'AI Reconciliation',
        status: 'success',
        result: reconciliationResult
      });
      console.log('✅ Reconciliation completed:', reconciliationResult);
    } catch (error: unknown) {
      results.tasks.push({
        name: 'AI Reconciliation',
        status: 'error',
        error: getErrorMessage(error)
      });
      console.error('❌ Reconciliation error:', error);
    }

    // 2. Executar classificação de despesas
    console.log('🏷️ Running Expense Classification...');
    try {
      const { data: classificationResult } = await supabase.functions.invoke('ai-expense-classifier');
      results.tasks.push({
        name: 'Expense Classification',
        status: 'success',
        result: classificationResult
      });
      console.log('✅ Classification completed:', classificationResult);
    } catch (error: unknown) {
      results.tasks.push({
        name: 'Expense Classification',
        status: 'error',
        error: getErrorMessage(error)
      });
      console.error('❌ Classification error:', error);
    }

    // 3. Executar análise financeira
    console.log('📊 Running Financial Analysis...');
    try {
      const { data: analysisResult } = await supabase.functions.invoke('ai-financial-analyst');
      results.tasks.push({
        name: 'Financial Analysis',
        status: 'success',
        result: analysisResult
      });
      console.log('✅ Analysis completed:', analysisResult);

      // Se houver alertas críticos, enviar notificação
      if (analysisResult?.analysis?.alerts?.length > 0) {
        console.log('⚠️ CRITICAL ALERTS:', analysisResult.analysis.alerts);
        // TODO: Implementar sistema de notificações (email/SMS)
      }
    } catch (error: unknown) {
      results.tasks.push({
        name: 'Financial Analysis',
        status: 'error',
        error: getErrorMessage(error)
      });
      console.error('❌ Analysis error:', error);
    }

    // 4. Verificar boletos vencidos e atualizar status
    console.log('📅 Checking overdue invoices...');
    try {
      const { data: overdueInvoices, error: overdueError } = await supabase
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString())
        .select();

      if (overdueError) throw overdueError;

      results.tasks.push({
        name: 'Update Overdue Invoices',
        status: 'success',
        result: { updated: overdueInvoices?.length || 0 }
      });
      console.log(`✅ Updated ${overdueInvoices?.length || 0} overdue invoices`);
    } catch (error: unknown) {
      results.tasks.push({
        name: 'Update Overdue Invoices',
        status: 'error',
        error: getErrorMessage(error)
      });
      console.error('❌ Overdue update error:', error);
    }

    // Salvar log de execução
    const { error: logError } = await supabase
      .from('automation_logs')
      .insert({
        execution_date: new Date().toISOString(),
        tasks_executed: results.tasks.length,
        tasks_succeeded: results.tasks.filter((t: any) => t.status === 'success').length,
        tasks_failed: results.tasks.filter((t: any) => t.status === 'error').length,
        details: results
      });

    if (logError) {
      console.error('Error saving automation log:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '⏰ Automação executada com sucesso',
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in automation scheduler:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
