#!/usr/bin/env node
/**
 * Script para limpar todas as NFS-e de teste do banco
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

async function limparTestes() {
  console.log('\n🧹 Limpando NFS-e de teste...\n');

  // 1. Buscar todas as NFS-e de teste/homologação
  const { data: nfseTeste, error: fetchError } = await supabase
    .from('nfse')
    .select('id, numero_rps, serie_rps, status, created_at, tomador_razao_social, valor_servicos')
    .or('serie_rps.eq.8,serie_rps.eq.TESTE,status.eq.pending,status.eq.processing,status.eq.error');

  if (fetchError) {
    console.error('❌ Erro ao buscar NFS-e:', fetchError.message);
    process.exit(1);
  }

  console.log(`📋 Encontradas ${nfseTeste?.length || 0} NFS-e de teste:\n`);

  if (!nfseTeste || nfseTeste.length === 0) {
    console.log('   Nenhuma NFS-e de teste encontrada.');
    return;
  }

  // Listar as notas que serão excluídas
  for (const nfse of nfseTeste) {
    console.log(`   - RPS ${nfse.numero_rps} | Série ${nfse.serie_rps} | ${nfse.status} | R$ ${nfse.valor_servicos} | ${nfse.tomador_razao_social?.substring(0, 30) || 'N/A'}`);
  }

  const ids = nfseTeste.map(n => n.id);

  // 2. Limpar logs relacionados
  console.log('\n🗑️  Excluindo logs...');
  const { error: logError } = await supabase
    .from('nfse_log')
    .delete()
    .in('nfse_id', ids);

  if (logError) {
    console.log('   ⚠️  Erro ao excluir logs:', logError.message);
  } else {
    console.log('   ✅ Logs excluídos');
  }

  // 3. Excluir NFS-e de teste
  console.log('\n🗑️  Excluindo NFS-e de teste...');
  const { error: deleteError, count } = await supabase
    .from('nfse')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.error('❌ Erro ao excluir NFS-e:', deleteError.message);
    process.exit(1);
  }

  console.log(`   ✅ ${ids.length} NFS-e de teste excluídas`);

  // 4. Limpar NFS-e tomadas de teste (se houver)
  console.log('\n🗑️  Verificando NFS-e tomadas de teste...');
  const { data: tomadasTeste } = await supabase
    .from('nfse_tomadas')
    .select('id')
    .eq('status', 'pendente');

  if (tomadasTeste && tomadasTeste.length > 0) {
    const { error: tomadasError } = await supabase
      .from('nfse_tomadas')
      .delete()
      .in('id', tomadasTeste.map(t => t.id));

    if (!tomadasError) {
      console.log(`   ✅ ${tomadasTeste.length} NFS-e tomadas pendentes excluídas`);
    }
  } else {
    console.log('   Nenhuma NFS-e tomada pendente encontrada');
  }

  // 5. Limpar logs órfãos
  console.log('\n🗑️  Limpando logs órfãos...');
  const { error: orphanError } = await supabase
    .from('nfse_log')
    .delete()
    .is('nfse_id', null);

  if (!orphanError) {
    console.log('   ✅ Logs órfãos excluídos');
  }

  console.log('\n✅ Limpeza concluída!\n');
  console.log('📊 O sistema está pronto para emitir NFS-e em PRODUÇÃO.');
}

limparTestes().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
