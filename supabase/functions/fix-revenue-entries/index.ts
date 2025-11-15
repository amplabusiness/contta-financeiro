import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { getErrorMessage } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Invoice {
  id: string;
  client_id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  description: string;
}

interface ProcessingStats {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
}

async function processInvoices(
  supabaseClient: any,
  userId: string,
  invoices: Invoice[],
  revenueAccountId: string,
  receivableAccountId: string
) {
  const stats: ProcessingStats = {
    total: invoices.length,
    processed: 0,
    skipped: 0,
    errors: 0,
  };
  const errors: string[] = [];

  for (const invoice of invoices) {
    try {
      // Verificar se já existe lançamento
      const { data: existingEntries } = await supabaseClient
        .from('accounting_entries')
        .select('id')
        .eq('entry_type', 'receita')
        .eq('reference_type', 'invoice')
        .eq('reference_id', invoice.id);

      if (existingEntries && existingEntries.length > 0) {
        stats.skipped++;
        continue;
      }

      // Criar lançamento
      const entryDate = invoice.payment_date || invoice.due_date;
      const description = `Receita: ${invoice.description || 'Honorários'}`;

      const { data: entry, error: entryError } = await supabaseClient
        .from('accounting_entries')
        .insert({
          entry_date: entryDate,
          entry_type: 'receita',
          description: description,
          reference_type: 'invoice',
          reference_id: invoice.id,
          total_debit: invoice.amount,
          total_credit: invoice.amount,
          balanced: true,
          created_by: userId,
        })
        .select()
        .single();

      if (entryError) throw new Error(`Erro ao criar entrada: ${entryError.message}`);

      // Criar linhas
      const lines = [
        {
          entry_id: entry.id,
          account_id: receivableAccountId,
          debit: invoice.amount,
          credit: 0,
          description: 'Débito: Clientes a Receber',
        },
        {
          entry_id: entry.id,
          account_id: revenueAccountId,
          debit: 0,
          credit: invoice.amount,
          description: 'Crédito: Receita de Honorários',
        },
      ];

      const { error: linesError } = await supabaseClient
        .from('accounting_entry_lines')
        .insert(lines);

      if (linesError) {
        await supabaseClient
          .from('accounting_entries')
          .delete()
          .eq('id', entry.id);
        throw new Error(`Erro ao criar linhas: ${linesError.message}`);
      }

      stats.processed++;

      if (stats.processed % 50 === 0) {
        console.log(`✅ ${stats.processed}/${invoices.length} faturas processadas`);
      }

    } catch (error: unknown) {
      errors.push(`Fatura ${invoice.id}: ${getErrorMessage(error)}`);
      stats.errors++;
    }
  }

  console.log(`\n✅ CONCLUÍDO: ${stats.processed} criados, ${stats.skipped} já existiam, ${stats.errors} erros`);

  // Salvar log final
  await supabaseClient
    .from('audit_logs')
    .insert({
      title: 'Correção Automática de Receitas',
      description: `Processamento concluído: ${stats.processed} lançamentos criados`,
      audit_type: 'system',
      entity_type: 'accounting_entries',
      severity: 'info',
      created_by: userId,
      metadata: { stats, errors: errors.slice(0, 10) },
    });

  return stats;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Iniciando correção de lançamentos de receita...');

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    console.log(`👤 Usuário autenticado: ${user.id}`);

    // Buscar contas necessárias
    const { data: revenueAccount, error: revenueError } = await supabaseClient
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', '3.1.1')
      .eq('is_active', true)
      .single();

    if (revenueError || !revenueAccount) {
      throw new Error('Conta de receita 3.1.1 não encontrada');
    }

    const { data: receivableAccount, error: receivableError } = await supabaseClient
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', '1.1.3')
      .eq('is_active', true)
      .single();

    if (receivableError || !receivableAccount) {
      throw new Error('Conta 1.1.3 (Clientes a Receber) não encontrada');
    }

    console.log(`📋 Contas encontradas: Receita ${revenueAccount.code}, A Receber ${receivableAccount.code}`);

    // Buscar todas as faturas pagas
    const { data: paidInvoices, error: invoicesError } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('status', 'paid')
      .order('due_date');

    if (invoicesError) {
      throw new Error(`Erro ao buscar faturas: ${invoicesError.message}`);
    }

    const totalInvoices = paidInvoices?.length || 0;
    console.log(`💰 Encontradas ${totalInvoices} faturas pagas - processando todas automaticamente...`);

    if (totalInvoices === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma fatura para processar',
          stats: { total: 0, processed: 0, skipped: 0, errors: 0 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Processar todas as faturas
    const stats = await processInvoices(
      supabaseClient,
      user.id,
      paidInvoices as Invoice[],
      revenueAccount.id,
      receivableAccount.id
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processamento concluído com sucesso!',
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: getErrorMessage(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
