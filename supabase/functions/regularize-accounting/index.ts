import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    console.log('Iniciando regularização de lançamentos contábeis...');

    // Buscar todas as invoices que não têm lançamentos contábeis
    const { data: invoicesWithoutEntries } = await supabaseClient
      .from('invoices')
      .select('*, clients(name)')
      .order('competence', { ascending: true })
      .order('due_date', { ascending: true });

    if (!invoicesWithoutEntries || invoicesWithoutEntries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma invoice encontrada', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontradas ${invoicesWithoutEntries.length} invoices para processar`);

    let provisionsCreated = 0;
    let paymentsCreated = 0;
    let errors: string[] = [];

    for (const invoice of invoicesWithoutEntries) {
      try {
        // Verificar se já existem lançamentos para esta invoice
        const { data: existingEntries } = await supabaseClient
          .from('accounting_entries')
          .select('id, entry_type')
          .eq('reference_type', 'invoice')
          .eq('reference_id', invoice.id);

        const hasProvision = existingEntries?.some(e => e.entry_type === 'provisionamento');
        const hasPayment = existingEntries?.some(e => e.entry_type === 'recebimento');

        // 1. Criar provisionamento se não existir
        if (!hasProvision) {
          console.log(`Criando provisionamento para invoice ${invoice.id} - ${invoice.clients?.name} - ${invoice.competence}`);
          
          const { error: provisionError } = await supabaseClient.functions.invoke('create-accounting-entry', {
            body: {
              type: 'invoice',
              operation: 'provision',
              referenceId: invoice.id,
              amount: parseFloat(invoice.amount),
              date: invoice.due_date, // Data de competência (vencimento)
              description: invoice.description || `Honorários ${invoice.competence}`,
              clientId: invoice.client_id,
            },
          });

          if (provisionError) {
            console.error(`Erro ao criar provisionamento para invoice ${invoice.id}:`, provisionError);
            errors.push(`Provisionamento ${invoice.id}: ${provisionError.message || 'Erro desconhecido'}`);
          } else {
            provisionsCreated++;
            console.log(`✓ Provisionamento criado para invoice ${invoice.id}`);
          }

          // Aguardar um pouco para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 2. Criar baixa/recebimento se invoice estiver paga e não tiver baixa
        if (invoice.status === 'paid' && invoice.payment_date && !hasPayment) {
          console.log(`Criando recebimento para invoice ${invoice.id} - ${invoice.clients?.name} - pago em ${invoice.payment_date}`);
          
          const { error: paymentError } = await supabaseClient.functions.invoke('create-accounting-entry', {
            body: {
              type: 'invoice',
              operation: 'payment',
              referenceId: invoice.id,
              amount: parseFloat(invoice.calculated_amount || invoice.amount),
              date: invoice.payment_date,
              description: invoice.description || `Recebimento ${invoice.competence}`,
              clientId: invoice.client_id,
            },
          });

          if (paymentError) {
            console.error(`Erro ao criar recebimento para invoice ${invoice.id}:`, paymentError);
            errors.push(`Recebimento ${invoice.id}: ${paymentError.message || 'Erro desconhecido'}`);
          } else {
            paymentsCreated++;
            console.log(`✓ Recebimento criado para invoice ${invoice.id}`);
          }

          // Aguardar um pouco para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error: any) {
        console.error(`Erro ao processar invoice ${invoice.id}:`, error);
        errors.push(`Invoice ${invoice.id}: ${error.message}`);
      }
    }

    const result = {
      success: true,
      totalInvoices: invoicesWithoutEntries.length,
      provisionsCreated,
      paymentsCreated,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('Regularização concluída:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro na regularização:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao regularizar lançamentos contábeis' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
