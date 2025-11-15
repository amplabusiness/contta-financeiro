import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BrasilAPIResponse, BrasilAPISocio } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função auxiliar para delay com backoff exponencial
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função para fazer requisição com retry e backoff exponencial
async function fetchWithRetry(url: string, maxRetries = 3, initialDelay = 1000): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Tentativa ${attempt + 1}/${maxRetries}: ${url}`);
      const response = await fetch(url);
      
      // Se não for erro 429 (rate limit), retorna imediatamente
      if (response.status !== 429) {
        return response;
      }
      
      // Se for 429 e ainda temos tentativas, aguarda com backoff exponencial
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Rate limit atingido. Aguardando ${delay}ms antes de tentar novamente...`);
        await sleep(delay);
        continue;
      }
      
      // Última tentativa com 429, retorna o response
      return response;
    } catch (error) {
      lastError = error as Error;
      console.error(`Erro na tentativa ${attempt + 1}:`, error);
      
      // Se ainda temos tentativas, aguarda com backoff exponencial
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Aguardando ${delay}ms antes de tentar novamente...`);
        await sleep(delay);
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  throw lastError || new Error('Todas as tentativas falharam');
}

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

    // Validar CNPJ
    if (cleanCnpj.length !== 14) {
      throw new Error(`CNPJ inválido: deve ter 14 dígitos, recebido ${cleanCnpj.length} (${cleanCnpj})`);
    }

    // Buscar dados na BrasilAPI com retry automático
    const brasilApiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`;
    console.log(`Buscando dados em: ${brasilApiUrl}`);
    
    const response = await fetchWithRetry(brasilApiUrl, 3, 2000);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro da BrasilAPI (${response.status}):`, errorText);
      
      if (response.status === 400) {
        throw new Error(`CNPJ inválido ou não encontrado na Receita Federal: ${cnpj}`);
      } else if (response.status === 404) {
        throw new Error(`CNPJ não encontrado: ${cnpj}`);
      } else if (response.status === 429) {
        throw new Error(`Limite de requisições atingido após múltiplas tentativas. Aguarde alguns minutos e tente novamente.`);
      } else {
        throw new Error(`BrasilAPI retornou erro ${response.status}: ${errorText}`);
      }
    }

    const data: BrasilAPIResponse = await response.json();
    console.log('Dados recebidos da BrasilAPI:', data);

    // Extrair sócios do QSA (Quadro de Sócios e Administradores)
    const socios = data.qsa?.map((socio: BrasilAPISocio) => ({
      nome: socio.nome_socio || socio.nome,
      qualificacao: socio.qualificacao_socio || socio.qual,
      data_entrada: socio.data_entrada_sociedade
    })) || [];

    // Atualizar dados do cliente principal
    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        porte: data.porte,
        natureza_juridica: data.natureza_juridica,
        situacao_cadastral: data.descricao_situacao_cadastral,
        data_abertura: data.data_inicio_atividade,
        capital_social: parseFloat(data.capital_social || '0'),
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        cep: data.cep,
        email: data.email || null,
        phone: data.ddd_telefone_1 || null,
        // ✅ NOVOS CAMPOS ADICIONADOS DA API BRASIL
        telefone_secundario: data.ddd_telefone_2 || null,
        fax: data.ddd_fax || null,
        opcao_pelo_simples: data.opcao_pelo_simples || false,
        data_opcao_simples: data.data_opcao_pelo_simples || data.data_opcao_simples || null,
        opcao_pelo_mei: data.opcao_pelo_mei || false,
        motivo_situacao_cadastral: data.motivo_situacao_cadastral || null,
        data_situacao_cadastral: data.data_situacao_cadastral || null,
        // FIM NOVOS CAMPOS
        atividade_principal: data.cnae_fiscal_descricao ? {
          codigo: data.cnae_fiscal,
          descricao: data.cnae_fiscal_descricao
        } : null,
        atividades_secundarias: data.cnaes_secundarios ? JSON.stringify(data.cnaes_secundarios) : null,
        qsa: socios
      })
      .eq('id', clientId);

    if (clientUpdateError) throw clientUpdateError;

    // Salvar dados enriquecidos na tabela de histórico
    const enrichmentData = {
      client_id: clientId,
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
      atividades_secundarias: data.cnaes_secundarios ? JSON.stringify(data.cnaes_secundarios) : null,
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
