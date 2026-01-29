// scripts/correcao_contabil/66_corrigir_competence_date_abertura.cjs
// Corrigir competence_date dos lançamentos de saldo de abertura para 31/12/2024

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DATA_COMPETENCIA_ABERTURA = '2024-12-01'; // Dezembro/2024

async function corrigir() {
  console.log('='.repeat(100));
  console.log('CORRIGINDO competence_date DOS LANÇAMENTOS DE SALDO DE ABERTURA');
  console.log('='.repeat(100));

  // 1. Verificar situação atual
  const { data: antes } = await supabase
    .from('accounting_entries')
    .select('competence_date')
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA');

  const competenciasAntes = {};
  antes?.forEach(e => {
    const comp = e.competence_date || 'NULL';
    competenciasAntes[comp] = (competenciasAntes[comp] || 0) + 1;
  });

  console.log('\n📊 ANTES - Distribuição de competence_date:');
  Object.entries(competenciasAntes).sort().forEach(([comp, qtd]) => {
    console.log(`   ${comp}: ${qtd} lançamentos`);
  });

  // 2. Atualizar todos para 2024-12-01 (dezembro/2024)
  console.log(`\n⏳ Atualizando competence_date para ${DATA_COMPETENCIA_ABERTURA}...`);

  const { data: updated, error } = await supabase
    .from('accounting_entries')
    .update({ competence_date: DATA_COMPETENCIA_ABERTURA })
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA')
    .select();

  if (error) {
    console.error('❌ Erro ao atualizar:', error);
    return;
  }

  console.log(`✅ ${updated?.length || 0} lançamentos atualizados`);

  // 3. Verificar resultado
  const { data: depois } = await supabase
    .from('accounting_entries')
    .select('competence_date')
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA');

  const competenciasDepois = {};
  depois?.forEach(e => {
    const comp = e.competence_date || 'NULL';
    competenciasDepois[comp] = (competenciasDepois[comp] || 0) + 1;
  });

  console.log('\n📊 DEPOIS - Distribuição de competence_date:');
  Object.entries(competenciasDepois).sort().forEach(([comp, qtd]) => {
    console.log(`   ${comp}: ${qtd} lançamentos`);
  });

  if (Object.keys(competenciasDepois).length === 1 && Object.keys(competenciasDepois)[0] === DATA_COMPETENCIA_ABERTURA) {
    console.log('\n✅ SUCESSO! Todos os saldos de abertura estão com competence_date = 2024-12-01');
    console.log('\n📌 Agora ao selecionar Janeiro/2025:');
    console.log('   - Lançamentos com competence_date < 2025-01-01 vão para SALDO INICIAL');
    console.log('   - Lançamentos do tipo SALDO_ABERTURA dentro do período também vão para SALDO INICIAL');
  }
}

corrigir().catch(console.error);
