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
      operation, // 'provision' (provisionamento) ou 'payment' (pagamento/recebimento)
      referenceId,
      amount,
      date,
      description,
      clientId
    } = await req.json();

    console.log('Creating accounting entry:', { type, operation, referenceId, amount, date, description });

    if (type === 'invoice') {
      if (operation === 'provision') {
        // PROVISIONAMENTO DE RECEITA (Regime de Competência)
        // Débito: Clientes a Receber (1.1.3)
        // Crédito: Receita de Honorários (3.1.1)

        const { data: receivableAccount } = await supabaseClient
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '1.1.3')
          .eq('type', 'ativo')
          .single();

        const { data: revenueAccount } = await supabaseClient
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '3.1.1')
          .eq('type', 'receita')
          .single();

        if (!receivableAccount || !revenueAccount) {
          throw new Error('Contas contábeis não encontradas (Clientes a Receber ou Receita)');
        }

        const { data: entry, error: entryError } = await supabaseClient
          .from('accounting_entries')
          .insert({
            entry_date: date,
            entry_type: 'provisionamento',
            description: `Provisionamento de receita: ${description}`,
            reference_type: 'invoice',
            reference_id: referenceId,
            created_by: user.id,
          })
          .select()
          .single();

        if (entryError) throw entryError;

        const { error: linesError } = await supabaseClient
          .from('accounting_entry_lines')
          .insert([
            {
              entry_id: entry.id,
              account_id: receivableAccount.id,
              description: `A receber: ${description}`,
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

        // Criar lançamento no razão do cliente (débito = valor a receber)
        if (clientId) {
          await supabaseClient
            .from('client_ledger')
            .insert({
              client_id: clientId,
              transaction_date: date,
              description: `Provisionamento: ${description}`,
              debit: amount,
              credit: 0,
              balance: 0,
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

      } else if (operation === 'payment') {
        // RECEBIMENTO (Baixa do Contas a Receber)
        // Débito: Caixa (1.1.1)
        // Crédito: Clientes a Receber (1.1.3)

        const { data: cashAccount } = await supabaseClient
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '1.1.1')
          .eq('type', 'ativo')
          .single();

        const { data: receivableAccount } = await supabaseClient
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '1.1.3')
          .eq('type', 'ativo')
          .single();

        if (!cashAccount || !receivableAccount) {
          throw new Error('Contas contábeis não encontradas (Caixa ou Clientes a Receber)');
        }

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
              account_id: receivableAccount.id,
              description: `Baixa de recebível: ${description}`,
              debit: 0,
              credit: amount,
            },
          ]);

        if (linesError) throw linesError;

        // Criar lançamento no razão do cliente (crédito = baixa do valor a receber)
        if (clientId) {
          await supabaseClient
            .from('client_ledger')
            .insert({
              client_id: clientId,
              transaction_date: date,
              description: `Recebimento: ${description}`,
              debit: 0,
              credit: amount,
              balance: 0,
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
      }

    } else if (type === 'expense') {
      // Buscar a despesa para pegar a account_id
      const { data: expense } = await supabaseClient
        .from('expenses')
        .select('account_id')
        .eq('id', referenceId)
        .single();

      if (!expense?.account_id) {
        throw new Error('Despesa sem conta contábil associada');
      }

      // Buscar a conta de despesa
      const { data: expenseAccount } = await supabaseClient
        .from('chart_of_accounts')
        .select('code')
        .eq('id', expense.account_id)
        .single();

      if (!expenseAccount) {
        throw new Error('Conta de despesa não encontrada');
      }

      if (operation === 'provision') {
        // PROVISIONAMENTO DE DESPESA (Regime de Competência)
        // Débito: Despesa (4.x)
        // Crédito: Fornecedores a Pagar (2.x)

        // Mapear conta de despesa (4.x) para conta de passivo (2.x)
        const liabilityCode = expenseAccount.code.replace(/^4\.1/, '2.1');

        const { data: liabilityAccount } = await supabaseClient
          .from('chart_of_accounts')
          .select('id')
          .eq('code', liabilityCode)
          .eq('type', 'passivo')
          .single();

        if (!liabilityAccount) {
          throw new Error(`Conta de passivo ${liabilityCode} não encontrada para provisionamento`);
        }

        const { data: entry, error: entryError } = await supabaseClient
          .from('accounting_entries')
          .insert({
            entry_date: date,
            entry_type: 'provisionamento',
            description: `Provisionamento: ${description}`,
            reference_type: 'expense',
            reference_id: referenceId,
            created_by: user.id,
          })
          .select()
          .single();

        if (entryError) throw entryError;

        const { error: linesError } = await supabaseClient
          .from('accounting_entry_lines')
          .insert([
            {
              entry_id: entry.id,
              account_id: expense.account_id,
              description: `Despesa: ${description}`,
              debit: amount,
              credit: 0,
            },
            {
              entry_id: entry.id,
              account_id: liabilityAccount.id,
              description: `A pagar: ${description}`,
              debit: 0,
              credit: amount,
            },
          ]);

        if (linesError) throw linesError;

        return new Response(
          JSON.stringify({ success: true, entryId: entry.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } else if (operation === 'payment') {
        // PAGAMENTO (Baixa do Contas a Pagar)
        // Débito: Fornecedores a Pagar (2.x)
        // Crédito: Caixa (1.1.1)

        // Mapear conta de despesa (4.x) para conta de passivo (2.x)
        const liabilityCode = expenseAccount.code.replace(/^4\.1/, '2.1');

        const { data: liabilityAccount } = await supabaseClient
          .from('chart_of_accounts')
          .select('id')
          .eq('code', liabilityCode)
          .eq('type', 'passivo')
          .single();

        const { data: cashAccount } = await supabaseClient
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '1.1.1')
          .eq('type', 'ativo')
          .single();

        if (!liabilityAccount || !cashAccount) {
          throw new Error('Contas contábeis não encontradas para pagamento');
        }

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
    }

    return new Response(
      JSON.stringify({ error: 'Tipo inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao criar lançamento contábil' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
