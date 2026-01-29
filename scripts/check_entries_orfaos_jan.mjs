/**
 * Verificar entries órfãos (sem items) em janeiro 2025
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('═'.repeat(80));
  console.log('VERIFICAR ENTRIES ÓRFÃOS - JANEIRO 2025');
  console.log('═'.repeat(80));

  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const orfaos = [];
  const tiposOrfaos = {};

  for (const entry of entries || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id')
      .eq('entry_id', entry.id);

    if (!items || items.length === 0) {
      orfaos.push(entry);
      tiposOrfaos[entry.entry_type] = (tiposOrfaos[entry.entry_type] || 0) + 1;
    }
  }

  console.log(`\n📊 Entries órfãos encontrados: ${orfaos.length}`);

  console.log('\n📋 Por tipo:');
  for (const [tipo, qtd] of Object.entries(tiposOrfaos).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${tipo}: ${qtd}`);
  }

  // Mostrar todos os entries manuais órfãos
  const manuais = orfaos.filter(e => e.entry_type === 'manual');
  console.log(`\n📋 Entries MANUAIS órfãos (${manuais.length}):`);
  for (const e of manuais) {
    console.log(`[${e.entry_date}] ${e.entry_type} | ${e.description?.substring(0, 60)}`);
  }

  console.log('\n📋 Primeiros 20 órfãos (outros tipos):');
  for (const e of orfaos.filter(x => x.entry_type !== 'manual').slice(0, 20)) {
    console.log(`[${e.entry_date}] ${e.entry_type} | ${e.description?.substring(0, 50)}`);
  }

  // Perguntar se quer deletar
  console.log('\n' + '═'.repeat(80));
  console.log('💡 Para deletar os entries órfãos, execute:');
  console.log('   node scripts/check_entries_orfaos_jan.mjs deletar');
  console.log('═'.repeat(80));

  if (process.argv[2] === 'deletar') {
    console.log('\n🗑️  Deletando entries órfãos...');

    for (const e of orfaos) {
      const { error } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('id', e.id);

      if (error) {
        console.log(`   ❌ Erro deletando ${e.id}: ${error.message}`);
      }
    }

    console.log(`   ✅ ${orfaos.length} entries órfãos deletados`);
  }
}

main().catch(console.error);
