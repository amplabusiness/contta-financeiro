#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function emitirAgora() {
  console.log('📤 Iniciando emissão...\n');

  try {
    // 1. Buscar config
    const { data: configs } = await supabase.from('nfse_config').select('*');
    if (!configs?.length) throw new Error('Sem config NFS-e');
    const config = configs[0];
    console.log('✅ Config:', config.ambiente, '| CNPJ:', config.prestador_cnpj);

    // 2. Criar registro NFS-e
    const numero_rps = Math.floor(Math.random() * 1000);
    const { data: nfse, error: nfseErr } = await supabase.from('nfse').insert({
      numero_rps: String(numero_rps).padStart(3, '0'),
      serie_rps: 'A',
      prestador_cnpj: config.prestador_cnpj,
      tomador_razao_social: 'TESTE ' + new Date().getTime(),
      tomador_cnpj: '24544420000105',
      discriminacao: 'Serviço de consultoria',
      valor_servicos: 1000.00,
      data_emissao: new Date().toISOString().split('T')[0],
      competencia: new Date().toISOString().split('T')[0],
      status: 'pending'
    }).select().single();

    if (nfseErr) {
      console.error('❌ Erro ao criar NFS-e:', nfseErr.message);
      throw nfseErr;
    }

    console.log('✅ NFS-e criada: ID =', nfse.id);
    console.log('   RPS:', nfse.numero_rps + '/' + nfse.serie_rps);
    console.log('   Valor: R$', nfse.valor_servicos);

    // 3. Simular emissão (sem SOAP por enquanto)
    console.log('\n📄 Simulando emissão...');
    const protocolo = 'SIM-' + Date.now();
    
    const { error: updateErr } = await supabase.from('nfse').update({
      status: 'processing',
      protocolo: protocolo,
      numero_lote: String(numero_rps)
    }).eq('id', nfse.id);

    if (updateErr) throw updateErr;

    console.log('✅ Status atualizado para "processing"');
    console.log('   Protocolo:', protocolo);

    // 4. Verificar resultado
    const { data: updated } = await supabase.from('nfse').select('*').eq('id', nfse.id).single();
    console.log('\n✅ RESULTADO FINAL:');
    console.log('   ID:', updated.id);
    console.log('   RPS:', updated.numero_rps + '/' + updated.serie_rps);
    console.log('   Status:', updated.status);
    console.log('   Protocolo:', updated.protocolo);

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    process.exit(1);
  }
}

emitirAgora();
