import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const authHeader = req.headers.get('Authorization')!;

    console.log('Starting cash flow synchronization...');

    // Buscar faturas pendentes
    const invoicesResponse = await fetch(
      `${supabaseUrl}/rest/v1/invoices?status=eq.pending&select=*,clients(name)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': authHeader,
        }
      }
    );
    const invoices = invoicesResponse.ok ? await invoicesResponse.json() : [];
    console.log(`Found ${invoices.length} pending invoices`);

    // Buscar contas a pagar pendentes
    const payablesResponse = await fetch(
      `${supabaseUrl}/rest/v1/accounts_payable?status=in.(pending,approved)&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': authHeader,
        }
      }
    );
    const payables = payablesResponse.ok ? await payablesResponse.json() : [];
    console.log(`Found ${payables.length} pending payables`);

    // Buscar despesas pendentes
    const expensesResponse = await fetch(
      `${supabaseUrl}/rest/v1/expenses?status=eq.pending&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': authHeader,
        }
      }
    );
    const expenses = expensesResponse.ok ? await expensesResponse.json() : [];
    console.log(`Found ${expenses.length} pending expenses`);

    const createdTransactions = [];
    const errors = [];

    // Criar transações de entrada (faturas)
    for (const invoice of invoices) {
      try {
        // Verificar se já existe transação para esta fatura
        const existingResponse = await fetch(
          `${supabaseUrl}/rest/v1/cash_flow_transactions?reference_type=eq.invoice&reference_id=eq.${invoice.id}`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': authHeader,
            }
          }
        );
        const existing = existingResponse.ok ? await existingResponse.json() : [];

        if (existing.length === 0) {
          const clientName = invoice.clients?.[0]?.name || invoice.clients?.name || 'Cliente não identificado';
          
          const transaction = {
            transaction_type: 'inflow',
            description: `Fatura - ${clientName}`,
            amount: invoice.amount,
            transaction_date: invoice.due_date,
            category: 'Honorários',
            status: 'projected',
            reference_type: 'invoice',
            reference_id: invoice.id,
            created_by: invoice.created_by,
          };

          const createResponse = await fetch(
            `${supabaseUrl}/rest/v1/cash_flow_transactions`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(transaction)
            }
          );

          if (createResponse.ok) {
            const created = await createResponse.json();
            createdTransactions.push(created[0]);
            console.log(`Created inflow transaction for invoice ${invoice.id}`);
          } else {
            const errorText = await createResponse.text();
            errors.push({ type: 'invoice', id: invoice.id, error: errorText });
            console.error(`Error creating transaction for invoice ${invoice.id}:`, errorText);
          }
        }
      } catch (error) {
        console.error(`Error processing invoice ${invoice.id}:`, error);
        errors.push({ type: 'invoice', id: invoice.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Criar transações de saída (contas a pagar)
    for (const payable of payables) {
      try {
        // Verificar se já existe transação para esta conta
        const existingResponse = await fetch(
          `${supabaseUrl}/rest/v1/cash_flow_transactions?reference_type=eq.account_payable&reference_id=eq.${payable.id}`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': authHeader,
            }
          }
        );
        const existing = existingResponse.ok ? await existingResponse.json() : [];

        if (existing.length === 0) {
          const transaction = {
            transaction_type: 'outflow',
            description: `${payable.supplier_name} - ${payable.description}`,
            amount: payable.amount,
            transaction_date: payable.due_date,
            category: payable.category,
            status: payable.status === 'approved' ? 'projected' : 'projected',
            reference_type: 'account_payable',
            reference_id: payable.id,
            created_by: payable.created_by,
          };

          const createResponse = await fetch(
            `${supabaseUrl}/rest/v1/cash_flow_transactions`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(transaction)
            }
          );

          if (createResponse.ok) {
            const created = await createResponse.json();
            createdTransactions.push(created[0]);
            console.log(`Created outflow transaction for payable ${payable.id}`);
          } else {
            const errorText = await createResponse.text();
            errors.push({ type: 'payable', id: payable.id, error: errorText });
            console.error(`Error creating transaction for payable ${payable.id}:`, errorText);
          }
        }
      } catch (error) {
        console.error(`Error processing payable ${payable.id}:`, error);
        errors.push({ type: 'payable', id: payable.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Criar transações de saída (despesas)
    for (const expense of expenses) {
      try {
        // Verificar se já existe transação para esta despesa
        const existingResponse = await fetch(
          `${supabaseUrl}/rest/v1/cash_flow_transactions?reference_type=eq.expense&reference_id=eq.${expense.id}`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': authHeader,
            }
          }
        );
        const existing = existingResponse.ok ? await existingResponse.json() : [];

        if (existing.length === 0) {
          const transaction = {
            transaction_type: 'outflow',
            description: expense.description,
            amount: expense.amount,
            transaction_date: expense.due_date,
            category: expense.category,
            status: 'projected',
            reference_type: 'expense',
            reference_id: expense.id,
            created_by: expense.created_by,
          };

          const createResponse = await fetch(
            `${supabaseUrl}/rest/v1/cash_flow_transactions`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(transaction)
            }
          );

          if (createResponse.ok) {
            const created = await createResponse.json();
            createdTransactions.push(created[0]);
            console.log(`Created outflow transaction for expense ${expense.id}`);
          } else {
            const errorText = await createResponse.text();
            errors.push({ type: 'expense', id: expense.id, error: errorText });
            console.error(`Error creating transaction for expense ${expense.id}:`, errorText);
          }
        }
      } catch (error) {
        console.error(`Error processing expense ${expense.id}:`, error);
        errors.push({ type: 'expense', id: expense.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`Synchronization complete. Created ${createdTransactions.length} transactions, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_created: createdTransactions.length,
          from_invoices: createdTransactions.filter(t => t.reference_type === 'invoice').length,
          from_payables: createdTransactions.filter(t => t.reference_type === 'account_payable').length,
          from_expenses: createdTransactions.filter(t => t.reference_type === 'expense').length,
          errors: errors.length
        },
        transactions: createdTransactions,
        errors: errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sync-cash-flow:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
