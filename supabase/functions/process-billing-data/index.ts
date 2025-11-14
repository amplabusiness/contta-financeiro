import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { billingData } = await req.json();

    console.log(`Processando ${billingData.length} registros de cobrança`);

    // Agrupar dados por cliente
    const clientBillingMap = new Map<string, { 
      totalAmount: number; 
      count: number; 
      dates: number[];
      name: string;
    }>();

    for (const record of billingData) {
      const clientName = record.pagador.trim().toUpperCase();
      const amount = parseFloat(record.valor.replace('.', '').replace(',', '.'));
      
      // Extrair dia do vencimento
      const [day, month, year] = record.dataVencimento.split('/');
      const paymentDay = parseInt(day);

      if (!clientBillingMap.has(clientName)) {
        clientBillingMap.set(clientName, {
          totalAmount: 0,
          count: 0,
          dates: [],
          name: record.pagador
        });
      }

      const clientData = clientBillingMap.get(clientName)!;
      clientData.totalAmount += amount;
      clientData.count += 1;
      clientData.dates.push(paymentDay);
    }

    // Processar cada cliente
    const results = [];
    for (const [clientKey, data] of clientBillingMap) {
      const averageAmount = data.totalAmount / data.count;
      
      // Calcular o dia de pagamento mais frequente
      const dayFrequency = data.dates.reduce((acc, day) => {
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      const mostFrequentDay = parseInt(
        Object.entries(dayFrequency)
          .sort(([, a], [, b]) => b - a)[0][0]
      );

      // Buscar cliente pelo nome (usando busca case-insensitive)
      const { data: clients, error: searchError } = await supabase
        .from('clients')
        .select('id, name, monthly_fee, payment_day')
        .ilike('name', `%${data.name}%`)
        .limit(5);

      if (searchError) {
        console.error(`Erro ao buscar cliente ${data.name}:`, searchError);
        continue;
      }

      if (clients && clients.length > 0) {
        // Encontrou cliente(s)
        for (const client of clients) {
          const shouldUpdate = 
            !client.monthly_fee || 
            client.monthly_fee === 0 || 
            !client.payment_day;

          if (shouldUpdate) {
            const { error: updateError } = await supabase
              .from('clients')
              .update({
                monthly_fee: averageAmount,
                payment_day: mostFrequentDay
              })
              .eq('id', client.id);

            if (updateError) {
              console.error(`Erro ao atualizar cliente ${client.name}:`, updateError);
              results.push({
                client: data.name,
                status: 'error',
                message: updateError.message
              });
            } else {
              results.push({
                client: data.name,
                status: 'updated',
                amount: averageAmount,
                paymentDay: mostFrequentDay
              });
            }
          } else {
            results.push({
              client: data.name,
              status: 'skipped',
              message: 'Cliente já possui honorário cadastrado'
            });
          }
        }
      } else {
        results.push({
          client: data.name,
          status: 'not_found',
          message: 'Cliente não encontrado no cadastro',
          suggestedAmount: averageAmount,
          suggestedPaymentDay: mostFrequentDay
        });
      }
    }

    console.log(`Processamento concluído. ${results.length} registros processados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dados de cobrança processados com sucesso',
        results,
        summary: {
          total: results.length,
          updated: results.filter(r => r.status === 'updated').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          notFound: results.filter(r => r.status === 'not_found').length,
          errors: results.filter(r => r.status === 'error').length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao processar dados de cobrança:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
