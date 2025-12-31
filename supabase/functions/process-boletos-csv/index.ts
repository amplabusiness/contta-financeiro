import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BoletoInput {
  nossoNumero?: string;
  valorPago: number;
  dataLiquidacao: string | null;
  cliente?: string;
  cnpj?: string;
  descricao?: string;
  raw: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { boletos } = await req.json() as { boletos: BoletoInput[] };

    if (!boletos || !Array.isArray(boletos)) {
      throw new Error('Dados de boletos inválidos');
    }

    console.log(`Processando ${boletos.length} boletos...`);

    let imported = 0;
    let matched = 0;
    const errors: string[] = [];

    // Buscar conta de Clientes a Receber
    const { data: contaClientes } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '1.1.2.01')
      .single();

    // Buscar conta do Banco
    const { data: contaBanco } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '1.1.1.05')
      .single();

    if (!contaClientes || !contaBanco) {
      throw new Error('Contas contábeis não encontradas');
    }

    for (const boleto of boletos) {
      try {
        if (boleto.valorPago <= 0) continue;

        // Tentar encontrar cliente
        let clientId: string | null = null;
        let clientName = boleto.cliente || 'Cliente não identificado';

        if (boleto.cnpj) {
          const cnpjLimpo = boleto.cnpj.replace(/\D/g, '');
          const { data: cliente } = await supabase
            .from('clients')
            .select('id, name, nome_fantasia')
            .eq('cnpj', cnpjLimpo)
            .single();

          if (cliente) {
            clientId = cliente.id;
            clientName = cliente.nome_fantasia || cliente.name;
            matched++;
          }
        }

        if (!clientId && boleto.cliente) {
          // Buscar por nome
          const { data: clientes } = await supabase
            .from('clients')
            .select('id, name, nome_fantasia')
            .or(`name.ilike.%${boleto.cliente}%,nome_fantasia.ilike.%${boleto.cliente}%`)
            .limit(1);

          if (clientes && clientes.length > 0) {
            clientId = clientes[0].id;
            clientName = clientes[0].nome_fantasia || clientes[0].name;
            matched++;
          }
        }

        // Criar lançamento contábil
        const dataLancamento = boleto.dataLiquidacao
          ? new Date(boleto.dataLiquidacao).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert({
            entry_date: dataLancamento,
            competence_date: dataLancamento,
            description: `Recebimento boleto - ${clientName}`,
            entry_type: 'recebimento',
            status: 'posted'
          })
          .select()
          .single();

        if (entryError) throw entryError;

        // Criar linhas: D: Banco, C: Clientes
        const { error: linesError } = await supabase
          .from('accounting_entry_lines')
          .insert([
            {
              entry_id: entry.id,
              account_id: contaBanco.id,
              debit: boleto.valorPago,
              credit: 0,
              description: `D: Banco Sicredi`
            },
            {
              entry_id: entry.id,
              account_id: contaClientes.id,
              debit: 0,
              credit: boleto.valorPago,
              description: `C: Clientes a Receber`
            }
          ]);

        if (linesError) throw linesError;

        // Atualizar fatura se cliente identificado
        if (clientId) {
          await supabase
            .from('invoices')
            .update({ status: 'paid', paid_at: dataLancamento })
            .eq('client_id', clientId)
            .eq('amount', boleto.valorPago)
            .eq('status', 'pending')
            .limit(1);
        }

        imported++;

      } catch (error: any) {
        console.error(`Erro ao processar boleto:`, error);
        errors.push(error.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        matched,
        total: boletos.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
