// scripts/correcao_contabil/45_limpar_entries_orfaos.cjs
// Limpar entries de SALDO_ABERTURA TIMES criados sem items

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function limpar() {
  // Buscar entries de SALDO_ABERTURA TIMES
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, description')
    .eq('entry_type', 'SALDO_ABERTURA')
    .ilike('description', '%TIMES%');

  console.log('Entries de SALDO_ABERTURA TIMES encontrados:', entries?.length || 0);

  let deletados = 0;
  for (const e of entries || []) {
    // Verificar se tem items
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id')
      .eq('entry_id', e.id);

    if (items && items.length === 0) {
      console.log('Deletando entry sem items:', e.id, '-', e.description.substring(0, 50));
      await supabase.from('accounting_entries').delete().eq('id', e.id);
      deletados++;
    }
  }

  console.log('Entries deletados:', deletados);
  console.log('Limpeza concluída!');
}

limpar().catch(console.error);
