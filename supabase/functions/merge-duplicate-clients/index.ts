import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuplicateGroup {
  normalizedName: string;
  clients: Array<{
    id: string;
    name: string;
    cnpj: string | null;
    invoiceCount: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Sem autorização');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    const { mode } = await req.json();

    // Step 1: Identificar clientes duplicados
    const { data: allClients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, cnpj, status');

    if (clientsError) throw clientsError;

    // Normalizar nomes e agrupar duplicatas
    const normalizedGroups = new Map<string, typeof allClients>();
    
    allClients?.forEach(client => {
      const normalized = client.name
        .toUpperCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
      
      if (!normalizedGroups.has(normalized)) {
        normalizedGroups.set(normalized, []);
      }
      normalizedGroups.get(normalized)!.push(client);
    });

    // Filtrar apenas grupos com duplicatas
    const duplicateGroups: DuplicateGroup[] = [];
    
    for (const [normalizedName, clients] of normalizedGroups.entries()) {
      if (clients.length > 1) {
        // Contar faturas de cada cliente
        const clientsWithCounts = await Promise.all(
          clients.map(async (client) => {
            const { count } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('client_id', client.id);
            
            return {
              id: client.id,
              name: client.name,
              cnpj: client.cnpj,
              invoiceCount: count || 0,
            };
          })
        );

        duplicateGroups.push({
          normalizedName,
          clients: clientsWithCounts,
        });
      }
    }

    // Se mode é "preview", apenas retorna os duplicados
    if (mode === 'preview') {
      return new Response(
        JSON.stringify({
          success: true,
          duplicateGroups,
          totalDuplicates: duplicateGroups.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se mode é "merge", executar a mesclagem
    if (mode === 'merge') {
      const mergeResults = {
        merged: 0,
        deleted: 0,
        errors: [] as string[],
      };

      for (const group of duplicateGroups) {
        try {
          // Escolher qual cliente manter:
          // 1. Prioridade para o que tem CNPJ
          // 2. Se todos têm CNPJ ou nenhum tem, manter o com mais faturas
          const sortedClients = [...group.clients].sort((a, b) => {
            if (a.cnpj && !b.cnpj) return -1;
            if (!a.cnpj && b.cnpj) return 1;
            return b.invoiceCount - a.invoiceCount;
          });

          const keepClient = sortedClients[0];
          const deleteClients = sortedClients.slice(1);

          console.log(`Mesclando ${group.normalizedName}: mantendo ${keepClient.id}, deletando ${deleteClients.length} duplicatas`);

          // Transferir todas as faturas para o cliente mantido
          for (const duplicateClient of deleteClients) {
            // Atualizar invoices
            await supabase
              .from('invoices')
              .update({ client_id: keepClient.id })
              .eq('client_id', duplicateClient.id);

            // Atualizar client_ledger
            await supabase
              .from('client_ledger')
              .update({ client_id: keepClient.id })
              .eq('client_id', duplicateClient.id);

            // Atualizar collection_work_orders
            await supabase
              .from('collection_work_orders')
              .update({ client_id: keepClient.id })
              .eq('client_id', duplicateClient.id);

            // Atualizar bank_transaction_matches
            await supabase
              .from('bank_transaction_matches')
              .update({ client_id: keepClient.id })
              .eq('client_id', duplicateClient.id);

            // Atualizar client_payers
            await supabase
              .from('client_payers')
              .update({ client_id: keepClient.id })
              .eq('client_id', duplicateClient.id);

            // Atualizar boleto_report_items
            await supabase
              .from('boleto_report_items')
              .update({ client_id: keepClient.id })
              .eq('client_id', duplicateClient.id);

            // Deletar client_partners duplicados
            await supabase
              .from('client_partners')
              .delete()
              .eq('client_id', duplicateClient.id);

            // Deletar client_enrichment duplicados
            await supabase
              .from('client_enrichment')
              .delete()
              .eq('client_id', duplicateClient.id);

            // Finalmente, deletar o cliente duplicado
            const { error: deleteError } = await supabase
              .from('clients')
              .delete()
              .eq('id', duplicateClient.id);

            if (deleteError) {
              mergeResults.errors.push(`Erro ao deletar ${duplicateClient.name}: ${deleteError.message}`);
            } else {
              mergeResults.deleted++;
            }
          }

          // Atualizar o cliente mantido com os dados mais completos (se o duplicado tinha CNPJ e o mantido não)
          const bestCnpj = sortedClients.find(c => c.cnpj)?.cnpj;
          if (bestCnpj && !keepClient.cnpj) {
            await supabase
              .from('clients')
              .update({ cnpj: bestCnpj })
              .eq('id', keepClient.id);
          }

          mergeResults.merged++;

        } catch (err) {
          const error = err as Error;
          mergeResults.errors.push(`Erro ao mesclar ${group.normalizedName}: ${error.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          results: mergeResults,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Modo inválido. Use "preview" ou "merge".');

  } catch (err) {
    const error = err as Error;
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
