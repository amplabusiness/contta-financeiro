// scripts/correcao_contabil/74_limpar_entries_vazios.cjs
// Limpar entries sem items

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function limparEntriesVazios() {
  console.log('='.repeat(80));
  console.log('LIMPANDO ENTRIES VAZIOS (SEM ITEMS)');
  console.log('='.repeat(80));

  // Buscar entries de SALDO_ABERTURA
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, description')
    .eq('entry_type', 'SALDO_ABERTURA');

  console.log(`\nEntries de SALDO_ABERTURA encontrados: ${entries?.length || 0}`);

  let removidos = 0;
  for (const e of entries || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id')
      .eq('entry_id', e.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('id')
      .eq('entry_id', e.id);

    const temItems = items && items.length > 0;
    const temLines = lines && lines.length > 0;

    if (!temItems && !temLines) {
      console.log(`   Removendo entry vazio: ${e.description?.substring(0, 60)}`);
      await supabase.from('accounting_entries').delete().eq('id', e.id);
      removidos++;
    }
  }

  console.log(`\nEntries vazios removidos: ${removidos}`);
  console.log('='.repeat(80));
}

limparEntriesVazios().catch(console.error);
