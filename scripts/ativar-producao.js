#!/usr/bin/env node
/**
 * Script para ativar modo PRODUÇÃO na configuração NFS-e
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ativarProducao() {
  console.log('\n🔄 Ativando modo PRODUÇÃO para NFS-e...\n');

  // Buscar config atual
  const { data: configAtual, error: fetchError } = await supabase
    .from('nfse_config')
    .select('*')
    .single();

  if (fetchError) {
    console.error('❌ Erro ao buscar configuração:', fetchError.message);
    process.exit(1);
  }

  console.log('📋 Configuração atual:');
  console.log('   Ambiente:', configAtual.ambiente);
  console.log('   CNPJ:', configAtual.prestador_cnpj);
  console.log('   IM:', configAtual.prestador_inscricao_municipal);
  console.log('   URL Homologação:', configAtual.base_url_homologacao);
  console.log('   URL Produção:', configAtual.base_url_producao);

  // Atualizar para produção
  const { data: configNova, error: updateError } = await supabase
    .from('nfse_config')
    .update({
      ambiente: 'producao',
      base_url_producao: 'https://nfse.goiania.go.gov.br/ws',
      endpoint: 'nfse.asmx',
      serie_rps_padrao: configAtual.serie_rps_padrao || 'A',
    })
    .eq('prestador_cnpj', '23893032000169')
    .select()
    .single();

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError.message);
    process.exit(1);
  }

  console.log('\n✅ CONFIGURAÇÃO ATUALIZADA PARA PRODUÇÃO!\n');
  console.log('📋 Nova configuração:');
  console.log('   Ambiente:', configNova.ambiente);
  console.log('   URL:', `${configNova.base_url_producao}/${configNova.endpoint}`);
  console.log('   Série RPS:', configNova.serie_rps_padrao);
  console.log('   Código Município: 5208707 (Goiânia/GO)');

  console.log('\n⚠️  IMPORTANTE:');
  console.log('   - As notas emitidas agora terão VALIDADE JURÍDICA');
  console.log('   - Verifique os dados antes de emitir');
  console.log('   - Cancelamentos devem ser feitos via GIOF: (62) 3524-4040');
}

ativarProducao().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
