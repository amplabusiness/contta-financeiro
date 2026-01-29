// scripts/correcao_contabil/65_verificar_competence_date.cjs
// Verificar se os lançamentos tem competence_date preenchido

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO competence_date E entry_type DOS LANÇAMENTOS');
  console.log('='.repeat(100));

  // 1. Buscar lançamentos de saldo de abertura
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, competence_date, entry_type, description')
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA,entry_type.eq.saldo_abertura')
    .limit(20);

  console.log(`\n📋 Lançamentos de saldo de abertura: ${entries?.length || 0}`);

  entries?.forEach(e => {
    console.log(`   entry_date: ${e.entry_date} | competence_date: ${e.competence_date || 'NULL'}`);
    console.log(`   entry_type: "${e.entry_type}"`);
    console.log(`   descrição: ${e.description?.substring(0, 50)}`);
    console.log('   ---');
  });

  // 2. Verificar valores únicos de entry_type
  console.log('\n📊 Valores únicos de entry_type:');
  const { data: tipos } = await supabase
    .from('accounting_entries')
    .select('entry_type')
    .limit(1000);

  const tiposUnicos = [...new Set(tipos?.map(t => t.entry_type))];
  tiposUnicos.forEach(t => console.log(`   - "${t}"`));

  // 3. Verificar se competence_date está preenchido
  console.log('\n📊 Verificando competence_date:');

  const { count: totalEntries } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true });

  const { count: comCompetence } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true })
    .not('competence_date', 'is', null);

  console.log(`   Total de entries: ${totalEntries}`);
  console.log(`   Com competence_date preenchido: ${comCompetence}`);
  console.log(`   Sem competence_date: ${(totalEntries || 0) - (comCompetence || 0)}`);

  // 4. A função get_account_balances espera entry_type = 'saldo_abertura' (minúsculas)
  console.log('\n📌 PROBLEMA IDENTIFICADO:');
  console.log('   A função get_account_balances no banco usa:');
  console.log('   - competence_date (não entry_date)');
  console.log('   - entry_type = "saldo_abertura" (minúsculas)');
  console.log('   - accounting_entry_lines (não accounting_entry_items)');
}

verificar().catch(console.error);
