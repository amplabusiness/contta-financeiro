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

    const { clientId, cnpj } = await req.json();

    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Enriquecendo dados do cliente ${clientId} com CNPJ ${cnpj}`);

    // Limpar CNPJ (remover pontuação)
    const cleanCnpj = cnpj.replace(/\D/g, '');

    // Buscar dados na BrasilAPI
    const brasilApiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`;
    console.log(`Buscando dados em: ${brasilApiUrl}`);
    
    const response = await fetch(brasilApiUrl);
    
    if (!response.ok) {
      throw new Error(`BrasilAPI retornou erro ${response.status}`);
    }

    const data = await response.json();
    console.log('Dados recebidos da BrasilAPI:', data);

    // Extrair sócios do QSA (Quadro de Sócios e Administradores)
    const socios = data.qsa?.map((socio: any) => ({
      nome: socio.nome_socio || socio.nome,
      qualificacao: socio.qualificacao_socio || socio.qual,
      data_entrada: socio.data_entrada_sociedade
    })) || [];

    // Salvar dados enriquecidos
    const enrichmentData = {
      client_id: clientId,
      cnpj: cleanCnpj,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      porte: data.porte,
      natureza_juridica: data.natureza_juridica,
      situacao: data.descricao_situacao_cadastral,
      data_abertura: data.data_inicio_atividade,
      capital_social: parseFloat(data.capital_social || 0),
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
      socios: socios,
      qsa: data.qsa,
      last_updated: new Date().toISOString(),
      data_source: 'brasilapi'
    };

    const { error: enrichmentError } = await supabase
      .from('client_enrichment')
      .upsert(enrichmentData, { onConflict: 'client_id' });

    if (enrichmentError) throw enrichmentError;

    // Criar registros de pagadores automaticamente para cada sócio
    const { data: userData } = await supabase.auth.getUser(
      req.headers.get('authorization')?.replace('Bearer ', '') || ''
    );

    for (const socio of socios) {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('client_payers')
        .select('id')
        .eq('client_id', clientId)
        .eq('payer_name', socio.nome)
        .single();

      if (!existing) {
        await supabase
          .from('client_payers')
          .insert({
            client_id: clientId,
            payer_name: socio.nome,
            relationship: 'socio',
            notes: `Qualificação: ${socio.qualificacao}`,
            created_by: userData?.user?.id
          });
      }
    }

    console.log(`Cliente ${clientId} enriquecido com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dados enriquecidos com sucesso',
        data: enrichmentData,
        socios_count: socios.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao enriquecer dados:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
