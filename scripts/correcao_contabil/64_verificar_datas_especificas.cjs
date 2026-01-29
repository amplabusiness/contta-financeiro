// scripts/correcao_contabil/64_verificar_datas_especificas.cjs
// Verificar datas específicas dos lançamentos

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO DATAS ESPECÍFICAS DOS LANÇAMENTOS');
  console.log('='.repeat(100));

  // Buscar conta RESTAURANTE IUVACI
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01.0004')
    .single();

  console.log(`\n📊 ${conta?.code} - ${conta?.name}`);
  console.log(`   ID: ${conta?.id}`);

  // Buscar TODOS os lançamentos em lines
  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select('id, debit, credit, description, entry_id, accounting_entries(id, entry_date, description)')
    .eq('account_id', conta?.id);

  console.log(`\n   Lançamentos em accounting_entry_lines: ${lines?.length || 0}`);
  lines?.forEach(l => {
    console.log(`      Entry ID: ${l.entry_id}`);
    console.log(`      Entry Date: ${l.accounting_entries?.entry_date}`);
    console.log(`      D: ${l.debit} | C: ${l.credit}`);
    console.log(`      Descrição: ${l.accounting_entries?.description?.substring(0, 60)}`);
    console.log('      ---');
  });

  // Verificar se os entries existem
  console.log('\n   Verificando accounting_entries associados:');
  const entryIds = lines?.map(l => l.entry_id).filter(Boolean) || [];

  for (const entryId of entryIds) {
    const { data: entry } = await supabase
      .from('accounting_entries')
      .select('id, entry_date, description, entry_type')
      .eq('id', entryId)
      .single();

    if (entry) {
      console.log(`      ✓ ${entry.entry_date} | ${entry.entry_type} | ${entry.description?.substring(0, 50)}`);
    } else {
      console.log(`      ❌ Entry ${entryId} NÃO ENCONTRADO!`);
    }
  }

  // Verificar TIMES
  console.log('\n' + '='.repeat(100));

  const { data: contaTimes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01.0006')
    .single();

  console.log(`\n📊 ${contaTimes?.code} - ${contaTimes?.name}`);

  const { data: itemsTimes } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, credit, entry_id, accounting_entries(entry_date, description)')
    .eq('account_id', contaTimes?.id)
    .limit(5);

  console.log(`\n   Primeiros 5 lançamentos em accounting_entry_items:`);
  itemsTimes?.forEach(i => {
    console.log(`      ${i.accounting_entries?.entry_date} | D: ${i.debit} | C: ${i.credit} | ${i.accounting_entries?.description?.substring(0, 40)}`);
  });
}

verificar().catch(console.error);
