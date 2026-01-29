/**
 * CORRIGIR FOLHA DE PAGAMENTO - JANEIRO/2025
 *
 * Remover lançamentos indevidos:
 * 1. JOSIMAR - reembolsos (R$ 35,98, R$ 35,98, R$ 81,46) - dias 10, 23, 28
 * 2. ANDREA LEONE BASTOS - não é terceirizada (R$ 6.000 dia 14)
 *
 * USO: node scripts/corrigir_folha_jan2025.mjs [--execute]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTAR = process.argv.includes('--execute');

async function main() {
  console.log('═'.repeat(80));
  console.log('CORRIGIR FOLHA DE PAGAMENTO - JANEIRO/2025');
  console.log('═'.repeat(80));
  console.log('');

  if (!EXECUTAR) {
    console.log('🔍 MODO SIMULAÇÃO - Use --execute para aplicar as correções');
    console.log('');
  }

  // Buscar lançamentos de folha
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type, reference_id')
    .in('entry_type', ['PAGAMENTO_SALARIO', 'ADIANTAMENTO_SALARIO'])
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const paraRemover = [];

  for (const entry of entries || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit')
      .eq('entry_id', entry.id);

    const valor = items?.find(i => parseFloat(i.debit) > 0);
    const v = parseFloat(valor?.debit) || 0;
    const dia = new Date(entry.entry_date).getDate();

    // JOSIMAR - reembolsos (valores pequenos fora do dia 15 e 30)
    if (entry.description.includes('JOSIMAR')) {
      // CLT só pode ter: dia 15 (adiantamento) ou dia 29/30/31 (pagamento)
      const isDiaValido = (dia === 15 || dia === 14) || (dia >= 29);
      if (!isDiaValido) {
        paraRemover.push({
          id: entry.id,
          desc: entry.description,
          valor: v,
          data: entry.entry_date,
          motivo: 'Reembolso JOSIMAR (não é salário)',
          bank_tx_id: entry.reference_id
        });
      }
    }

    // ANDREA LEONE - não é terceirizada (é familiar/sócio)
    if (entry.description.toLowerCase().includes('andrea') &&
        entry.description.toLowerCase().includes('leone')) {
      paraRemover.push({
        id: entry.id,
        desc: entry.description,
        valor: v,
        data: entry.entry_date,
        motivo: 'ANDREA LEONE não é terceirizada',
        bank_tx_id: entry.reference_id
      });
    }
  }

  console.log('LANÇAMENTOS A REMOVER:');
  console.log('-'.repeat(80));

  let totalRemover = 0;
  for (const item of paraRemover) {
    console.log(`${item.data} | R$ ${item.valor.toFixed(2).padStart(10)} | ${item.motivo}`);
    console.log(`   ${item.desc.substring(0, 70)}`);
    totalRemover += item.valor;
  }

  console.log('-'.repeat(80));
  console.log(`Total a remover: ${paraRemover.length} lançamentos | R$ ${totalRemover.toFixed(2)}`);
  console.log('');

  if (!EXECUTAR) {
    console.log('⚠️  SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('   Execute com --execute para aplicar as correções');
    return;
  }

  // Executar remoção
  console.log('Removendo lançamentos...');

  for (const item of paraRemover) {
    // 1. Remover items
    const { error: itemsError } = await supabase
      .from('accounting_entry_items')
      .delete()
      .eq('entry_id', item.id);

    if (itemsError) {
      console.log(`   ❌ Erro ao remover items de ${item.id}: ${itemsError.message}`);
      continue;
    }

    // 2. Remover entry
    const { error: entryError } = await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', item.id);

    if (entryError) {
      console.log(`   ❌ Erro ao remover entry ${item.id}: ${entryError.message}`);
      continue;
    }

    // 3. Reverter status da transação bancária
    if (item.bank_tx_id) {
      await supabase
        .from('bank_transactions')
        .update({ status: 'pending', journal_entry_id: null })
        .eq('id', item.bank_tx_id);
    }

    console.log(`   ✅ Removido: ${item.data} | R$ ${item.valor.toFixed(2)} | ${item.motivo}`);
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ Correção concluída!');
  console.log('═'.repeat(80));
}

main().catch(console.error);
