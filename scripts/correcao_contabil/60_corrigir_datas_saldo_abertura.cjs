// scripts/correcao_contabil/60_corrigir_datas_saldo_abertura.cjs
// Corrigir datas dos lançamentos de saldo de abertura para 31/12/2024

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DATA_SALDO_ABERTURA = '2024-12-31';

async function corrigirDatas() {
  console.log('='.repeat(100));
  console.log('CORRIGINDO DATAS DOS LANÇAMENTOS DE SALDO DE ABERTURA PARA 31/12/2024');
  console.log('='.repeat(100));

  // 1. Buscar todos os lançamentos de saldo de abertura
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA')
    .neq('entry_date', DATA_SALDO_ABERTURA);

  if (error) {
    console.error('Erro ao buscar entries:', error);
    return;
  }

  console.log(`\n📋 Lançamentos para atualizar: ${entries?.length || 0}`);

  if (!entries?.length) {
    console.log('✅ Todos os lançamentos já estão com data 31/12/2024');
    return;
  }

  // 2. Mostrar lançamentos que serão atualizados
  console.log('\n📊 Lançamentos que serão atualizados:');
  const porData = {};
  entries.forEach(e => {
    if (!porData[e.entry_date]) porData[e.entry_date] = 0;
    porData[e.entry_date]++;
  });

  Object.entries(porData).sort().forEach(([data, qtd]) => {
    console.log(`   ${data} → ${DATA_SALDO_ABERTURA}: ${qtd} lançamentos`);
  });

  // 3. Atualizar as datas
  console.log('\n⏳ Atualizando datas...');

  const { data: updated, error: errUpdate } = await supabase
    .from('accounting_entries')
    .update({ entry_date: DATA_SALDO_ABERTURA })
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA')
    .neq('entry_date', DATA_SALDO_ABERTURA)
    .select();

  if (errUpdate) {
    console.error('❌ Erro ao atualizar:', errUpdate);
    return;
  }

  console.log(`\n✅ ${updated?.length || 0} lançamentos atualizados para ${DATA_SALDO_ABERTURA}`);

  // 4. Verificar resultado
  console.log('\n📊 Verificando resultado...');

  const { data: verificacao } = await supabase
    .from('accounting_entries')
    .select('entry_date')
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA');

  const datasUnicas = [...new Set(verificacao?.map(e => e.entry_date))];
  console.log(`   Datas encontradas: ${datasUnicas.join(', ')}`);

  if (datasUnicas.length === 1 && datasUnicas[0] === DATA_SALDO_ABERTURA) {
    console.log('\n✅ SUCESSO! Todos os saldos de abertura estão em 31/12/2024');
  }

  console.log('\n' + '='.repeat(100));
}

corrigirDatas().catch(console.error);
