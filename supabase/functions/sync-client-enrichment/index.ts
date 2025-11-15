import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BrasilAPIResponse, BrasilAPISocio, Socio } from '../_shared/types.ts'

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

    console.log('Iniciando sincronização automática dos dados da Receita Federal...');

    // Buscar todos os clientes ativos com CNPJ que precisam ser sincronizados
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        *,
        enrichment:client_enrichment(*)
      `)
      .eq('status', 'active')
      .not('cnpj', 'is', null);

    if (clientsError) throw clientsError;

    console.log(`Encontrados ${clients?.length || 0} clientes para sincronizar`);

    let synced = 0;
    let errors = 0;
    let changes_detected = 0;
    const syncResults = [];

    for (const client of clients || []) {
      try {
        const cleanCnpj = client.cnpj.replace(/\D/g, '');
        console.log(`Sincronizando cliente: ${client.name} (${cleanCnpj})`);

        // Buscar dados atualizados na BrasilAPI
        const brasilApiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`;
        const response = await fetch(brasilApiUrl);

        if (!response.ok) {
          console.error(`Erro ao buscar CNPJ ${cleanCnpj}: ${response.status}`);
          errors++;
          syncResults.push({
            client_id: client.id,
            client_name: client.name,
            status: 'error',
            message: `Erro ${response.status} na BrasilAPI`
          });
          continue;
        }

        const data: BrasilAPIResponse = await response.json();

        // Extrair sócios atuais
        const newSocios = data.qsa?.map((socio: BrasilAPISocio) => ({
          nome: socio.nome_socio || socio.nome,
          qualificacao: socio.qualificacao_socio || socio.qual,
          data_entrada: socio.data_entrada_sociedade
        })) || [];

        // Verificar se houve mudanças no quadro societário
        let sociosChanged = false;
        const addedSocios: string[] = [];
        const removedSocios: string[] = [];

        if (client.enrichment) {
          const oldSocios: Socio[] = client.enrichment.socios || [];
          const oldSociosNames = new Set(oldSocios.map((s) => s.nome));
          const newSociosNames = new Set(newSocios.map((s) => s.nome));

          // Verificar sócios adicionados
          for (const socio of newSocios) {
            if (socio.nome && !oldSociosNames.has(socio.nome)) {
              addedSocios.push(socio.nome);
              sociosChanged = true;
            }
          }

          // Verificar sócios removidos
          for (const socio of oldSocios) {
            if (!newSociosNames.has(socio.nome)) {
              removedSocios.push(socio.nome);
              sociosChanged = true;
            }
          }
        }

        // Atualizar dados enriquecidos
        const enrichmentData = {
          client_id: client.id,
          cnpj: cleanCnpj,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia,
          porte: data.porte,
          natureza_juridica: data.natureza_juridica,
          situacao: data.descricao_situacao_cadastral,
          data_abertura: data.data_inicio_atividade,
          capital_social: parseFloat(data.capital_social || '0'),
          logradouro: data.logradouro,
          numero: data.numero,
          complemento: data.complemento,
          bairro: data.bairro,
          municipio: data.municipio,
          uf: data.uf,
          cep: data.cep,
          telefone: data.ddd_telefone_1,
          email: data.email,
          atividade_principal: data.cnae_fiscal_descricao ? {
            codigo: data.cnae_fiscal,
            descricao: data.cnae_fiscal_descricao
          } : null,
          atividades_secundarias: data.cnaes_secundarios || [],
          socios: newSocios,
          qsa: data.qsa,
          last_updated: new Date().toISOString(),
          data_source: 'brasilapi'
        };

        const { error: enrichmentError } = await supabase
          .from('client_enrichment')
          .upsert(enrichmentData, { onConflict: 'client_id' });

        if (enrichmentError) throw enrichmentError;

        // Se houve mudanças no quadro societário, registrar no audit log
        if (sociosChanged) {
          changes_detected++;
          
          const changeDescription = [];
          if (addedSocios.length > 0) {
            changeDescription.push(`Novos sócios: ${addedSocios.join(', ')}`);
          }
          if (removedSocios.length > 0) {
            changeDescription.push(`Sócios removidos: ${removedSocios.join(', ')}`);
          }

          await supabase
            .from('audit_logs')
            .insert({
              audit_type: 'client_change',
              entity_type: 'client',
              entity_id: client.id,
              title: 'Mudança no Quadro Societário',
              description: `Detectada mudança automática no quadro societário de ${client.name}`,
              severity: 'warn',
              metadata: {
                added_socios: addedSocios,
                removed_socios: removedSocios,
                sync_date: new Date().toISOString()
              },
              created_by: '00000000-0000-0000-0000-000000000000' // Sistema
            });

          // Atualizar client_payers automaticamente
          // Adicionar novos sócios
          for (const socioName of addedSocios) {
            const socioData = newSocios.find((s) => s.nome === socioName);
            await supabase
              .from('client_payers')
              .insert({
                client_id: client.id,
                payer_name: socioName,
                relationship: 'socio',
                notes: `Adicionado automaticamente - Qualificação: ${socioData?.qualificacao}`,
                created_by: '00000000-0000-0000-0000-000000000000' // Sistema
              });
          }

          // Desativar sócios removidos
          if (removedSocios.length > 0) {
            await supabase
              .from('client_payers')
              .update({ is_active: false })
              .eq('client_id', client.id)
              .in('payer_name', removedSocios);
          }
        }

        synced++;
        syncResults.push({
          client_id: client.id,
          client_name: client.name,
          status: 'success',
          changes_detected: sociosChanged,
          added_socios: addedSocios,
          removed_socios: removedSocios
        });

        console.log(`Cliente ${client.name} sincronizado com sucesso`);

        // Aguardar 500ms entre requisições para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Erro ao sincronizar cliente ${client.id}:`, error);
        errors++;
        syncResults.push({
          client_id: client.id,
          client_name: client.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const summary = {
      total_clients: clients?.length || 0,
      synced,
      errors,
      changes_detected,
      sync_date: new Date().toISOString()
    };

    console.log('Sincronização concluída:', summary);

    // Registrar log da sincronização
    await supabase
      .from('audit_logs')
      .insert({
        audit_type: 'system',
        entity_type: 'sync',
        title: 'Sincronização Automática Concluída',
        description: `Sincronização mensal dos dados da Receita Federal concluída. ${synced} clientes atualizados, ${changes_detected} mudanças detectadas.`,
        severity: changes_detected > 0 ? 'warn' : 'info',
        metadata: summary,
        created_by: '00000000-0000-0000-0000-000000000000' // Sistema
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${synced} clientes atualizados`,
        summary,
        results: syncResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na sincronização automática:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
