/**
 * Limpar entries duplicados de DESPESA_BANCARIA
 * que foram criados mas não vinculados às transações bancárias
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] || 'simulacao';

async function main() {
  console.log('═'.repeat(80));
  console.log('LIMPAR ENTRIES DUPLICADOS DE DESPESA_BANCARIA');
  console.log(`Modo: ${MODO.toUpperCase()}`);
  console.log('═'.repeat(80));

  // Buscar entries de DESPESA_BANCARIA
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description')
    .eq('entry_type', 'DESPESA_BANCARIA')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log(`\nEntries DESPESA_BANCARIA encontrados: ${entries?.length || 0}`);

  // Verificar quais NÃO estão vinculados a transações bancárias
  let naoVinculados = [];

  for (const entry of entries || []) {
    const { data: tx } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('journal_entry_id', entry.id)
      .maybeSingle();

    if (!tx) {
      naoVinculados.push(entry);
    }
  }

  console.log(`Não vinculados a transações: ${naoVinculados.length}`);

  if (naoVinculados.length === 0) {
    console.log('✅ Nenhum entry duplicado encontrado');
    return;
  }

  console.log('\n📋 Entries a deletar:');
  for (const e of naoVinculados) {
    console.log(`[${e.entry_date}] ${e.description?.substring(0, 50)}`);
  }

  if (MODO === 'aplicar') {
    console.log('\n🗑️  Deletando...');

    for (const e of naoVinculados) {
      // Deletar items primeiro
      await supabase
        .from('accounting_entry_items')
        .delete()
        .eq('entry_id', e.id);

      // Deletar entry
      const { error } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('id', e.id);

      if (error) {
        console.log(`   ❌ Erro deletando ${e.id}: ${error.message}`);
      }
    }

    console.log(`   ✅ ${naoVinculados.length} entries deletados`);
  }

  console.log('\n' + '═'.repeat(80));
  if (MODO === 'simulacao') {
    console.log('💡 Para aplicar, execute:');
    console.log('   node scripts/limpar_tarifas_duplicadas.mjs aplicar');
  }
  console.log('═'.repeat(80));
}

main().catch(console.error);
