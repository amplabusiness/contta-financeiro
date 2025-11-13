import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      type, // 'invoice' ou 'expense'
      referenceId,
      amount,
      date,
      description,
      clientId
    } = await req.json();

    console.log('Creating accounting entry:', { type, referenceId, amount, date, description });

    if (type === 'invoice') {
      // Lançamento de recebimento de honorário
      // Débito: Caixa/Banco (1.1.1.01)
      // Crédito: Receita de Honorários (3.1.1.01)

      // Buscar conta de caixa
      const { data: cashAccount } = await supabaseClient
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '1.1.1.01')
        .eq('type', 'ativo')
        .single();

      // Buscar conta de receita
      const { data: revenueAccount } = await supabaseClient
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '3.1.1.01')
        .eq('type', 'receita')
        .single();

      if (!cashAccount || !revenueAccount) {
        throw new Error('Contas contábeis não encontradas. Configure o plano de contas.');
      }

      // Criar cabeçalho do lançamento
      const { data: entry, error: entryError } = await supabaseClient
        .from('accounting_entries')
        .insert({
          entry_date: date,
          entry_type: 'recebimento',
          description: `Recebimento: ${description}`,
          reference_type: 'invoice',
          reference_id: referenceId,
          created_by: user.id,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Criar linhas do lançamento
      const { error: linesError } = await supabaseClient
        .from('accounting_entry_lines')
        .insert([
          {
            entry_id: entry.id,
            account_id: cashAccount.id,
            description: `Recebimento: ${description}`,
            debit: amount,
            credit: 0,
          },
          {
            entry_id: entry.id,
            account_id: revenueAccount.id,
            description: `Receita: ${description}`,
            debit: 0,
            credit: amount,
          },
        ]);

      if (linesError) throw linesError;

      // Criar lançamento no razão do cliente
      if (clientId) {
        await supabaseClient
          .from('client_ledger')
          .insert({
            client_id: clientId,
            transaction_date: date,
            description: `Recebimento: ${description}`,
            debit: 0,
            credit: amount,
            balance: 0, // O trigger vai calcular
            reference_type: 'invoice',
            reference_id: referenceId,
            invoice_id: referenceId,
            created_by: user.id,
          });
      }

      return new Response(
        JSON.stringify({ success: true, entryId: entry.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'expense') {
      // Lançamento de pagamento de despesa
      // Débito: Passivo (2.x) - baixa da obrigação
      // Crédito: Caixa/Banco (1.1.1.01) - saída de dinheiro

      // Buscar a despesa para pegar a account_id
      const { data: expense } = await supabaseClient
        .from('expenses')
        .select('account_id')
        .eq('id', referenceId)
        .single();

      if (!expense?.account_id) {
        throw new Error('Despesa sem conta contábil associada');
      }

      // Buscar a conta de despesa para mapear para passivo
      const { data: expenseAccount } = await supabaseClient
        .from('chart_of_accounts')
        .select('code')
        .eq('id', expense.account_id)
        .single();

      if (!expenseAccount) {
        throw new Error('Conta de despesa não encontrada');
      }

      // Mapear conta de despesa (4.x) para conta de passivo (2.x)
      const liabilityCode = expenseAccount.code.replace(/^4/, '2');

      // Buscar a conta de passivo correspondente
      const { data: liabilityAccount } = await supabaseClient
        .from('chart_of_accounts')
        .select('id')
        .eq('code', liabilityCode)
        .eq('type', 'passivo')
        .single();

      // Buscar conta de caixa
      const { data: cashAccount } = await supabaseClient
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '1.1.1.01')
        .eq('type', 'ativo')
        .single();

      if (!liabilityAccount || !cashAccount) {
        throw new Error('Contas contábeis não encontradas para pagamento');
      }

      // Criar cabeçalho do lançamento
      const { data: entry, error: entryError } = await supabaseClient
        .from('accounting_entries')
        .insert({
          entry_date: date,
          entry_type: 'pagamento',
          description: `Pagamento: ${description}`,
          reference_type: 'expense',
          reference_id: referenceId,
          created_by: user.id,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Criar linhas do lançamento
      const { error: linesError } = await supabaseClient
        .from('accounting_entry_lines')
        .insert([
          {
            entry_id: entry.id,
            account_id: liabilityAccount.id,
            description: `Baixa de obrigação: ${description}`,
            debit: amount,
            credit: 0,
          },
          {
            entry_id: entry.id,
            account_id: cashAccount.id,
            description: `Pagamento: ${description}`,
            debit: 0,
            credit: amount,
          },
        ]);

      if (linesError) throw linesError;

      return new Response(
        JSON.stringify({ success: true, entryId: entry.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Tipo inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao criar lançamento contábil' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
