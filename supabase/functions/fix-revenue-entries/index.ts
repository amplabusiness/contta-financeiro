import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

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

    console.log(`💰 Encontradas ${paidInvoices?.length || 0} faturas pagas`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const invoice of paidInvoices as Invoice[]) {
      try {
        console.log(`\n🔍 Processando fatura ${invoice.id}...`);

        // Verificar se já existe lançamento de receita para esta fatura
        const { data: existingEntries, error: checkError } = await supabaseClient
          .from('accounting_entries')
          .select('id')
          .eq('entry_type', 'receita')
          .eq('reference_type', 'invoice')
          .eq('reference_id', invoice.id);

        if (checkError) {
          throw new Error(`Erro ao verificar lançamentos: ${checkError.message}`);
        }

        if (existingEntries && existingEntries.length > 0) {
          console.log(`⏭️  Fatura ${invoice.id} já possui lançamento de receita. Pulando...`);
          skippedCount++;
          continue;
        }

        // Criar lançamento de receita
        const entryDate = invoice.payment_date || invoice.due_date;
        const description = `Receita: ${invoice.description || 'Honorários'}`;

        console.log(`✨ Criando lançamento de receita para fatura ${invoice.id}...`);

        // Criar entrada contábil
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
            created_by: user.id,
          })
          .select()
          .single();

        if (entryError) {
          throw new Error(`Erro ao criar entrada: ${entryError.message}`);
        }

        console.log(`📝 Entrada criada: ${entry.id}`);

        // Criar linhas do lançamento
        const lines = [
          {
            entry_id: entry.id,
            account_id: receivableAccount.id,
            debit: invoice.amount,
            credit: 0,
            description: `Débito: ${receivableAccount.name}`,
          },
          {
            entry_id: entry.id,
            account_id: revenueAccount.id,
            debit: 0,
            credit: invoice.amount,
            description: `Crédito: ${revenueAccount.name}`,
          },
        ];

        const { error: linesError } = await supabaseClient
          .from('accounting_entry_lines')
          .insert(lines);

        if (linesError) {
          // Tentar deletar a entrada se as linhas falharem
          await supabaseClient
            .from('accounting_entries')
            .delete()
            .eq('id', entry.id);
          throw new Error(`Erro ao criar linhas: ${linesError.message}`);
        }

        console.log(`✅ Lançamento de receita criado com sucesso para fatura ${invoice.id}`);
        processedCount++;

      } catch (error: any) {
        console.error(`❌ Erro ao processar fatura ${invoice.id}:`, error.message);
        errors.push(`Fatura ${invoice.id}: ${error.message}`);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Processamento concluído`,
      stats: {
        total: paidInvoices?.length || 0,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('\n📊 Resultado final:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
