/**
 * CHECK DUPLICADOS BANCO SICREDI
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
  const contaSicrediId = '10d5892d-a843-4034-8d62-9fec95b8fd56';

  // Verificar se há items duplicados (mesmo entry_id)
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, credit, entry_id')
    .eq('account_id', contaSicrediId);

  // Contar quantos items por entry_id
  const porEntry = {};
  for (const item of items || []) {
    if (!porEntry[item.entry_id]) porEntry[item.entry_id] = [];
    porEntry[item.entry_id].push(item);
  }

  // Encontrar entries com mais de 1 item na mesma conta
  const duplicados = Object.entries(porEntry).filter(([, items]) => items.length > 1);

  console.log('Entries com múltiplos items na conta Sicredi:', duplicados.length);

  if (duplicados.length > 0) {
    console.log('');
    console.log('DUPLICADOS:');
    for (const [entryId, items] of duplicados.slice(0, 10)) {
      console.log('Entry:', entryId, '- Items:', items.length);
      for (const item of items) {
        console.log('  ID:', item.id, 'D:', item.debit, 'C:', item.credit);
      }
    }
  }

  // Verificar se há entries com o mesmo reference_id (transação bancária)
  const { data: entriesJan } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, reference_type, reference_id')
    .eq('reference_type', 'bank_transaction')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const porRefId = {};
  for (const e of entriesJan || []) {
    if (!e.reference_id) continue;
    if (!porRefId[e.reference_id]) porRefId[e.reference_id] = [];
    porRefId[e.reference_id].push(e);
  }

  const refDuplicados = Object.entries(porRefId).filter(([, entries]) => entries.length > 1);

  console.log('');
  console.log('Transações bancárias com múltiplos entries:', refDuplicados.length);

  if (refDuplicados.length > 0) {
    let totalDuplicados = 0;
    for (const [refId, entries] of refDuplicados.slice(0, 5)) {
      console.log('');
      console.log('Transação:', refId, '- Entries:', entries.length);
      for (const e of entries) {
        console.log('  ', e.entry_date, '-', e.description?.substring(0, 50));
      }
      totalDuplicados += entries.length - 1;
    }
    console.log('');
    console.log('Total de entries duplicados (excesso):', totalDuplicados);
  }

  // Verificar total de entries por mês
  console.log('');
  console.log('═'.repeat(80));
  console.log('ANÁLISE DETALHADA');
  console.log('═'.repeat(80));

  // Items do razão Sicredi em janeiro
  const { data: itemsComEntry } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, credit, entry:accounting_entries!inner(id, entry_date, reference_type, reference_id)')
    .eq('account_id', contaSicrediId);

  const itemsJan = (itemsComEntry || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  // Verificar se existem entries sem reference_type bank_transaction
  const semRefBanco = itemsJan.filter(i => i.entry?.reference_type !== 'bank_transaction');
  const comRefBanco = itemsJan.filter(i => i.entry?.reference_type === 'bank_transaction');

  console.log('');
  console.log('Items Janeiro/2025:');
  console.log('  Com reference_type=bank_transaction:', comRefBanco.length);
  console.log('  Sem reference_type bank_transaction:', semRefBanco.length);
  console.log('  Total:', itemsJan.length);

  let debitosSemRef = 0;
  let creditosSemRef = 0;
  for (const item of semRefBanco) {
    debitosSemRef += parseFloat(item.debit || 0);
    creditosSemRef += parseFloat(item.credit || 0);
  }

  console.log('');
  console.log('Valores SEM ref banco:');
  console.log('  Débitos:', debitosSemRef.toFixed(2));
  console.log('  Créditos:', creditosSemRef.toFixed(2));

  // Listar entries sem ref banco
  if (semRefBanco.length > 0) {
    console.log('');
    console.log('Entries SEM reference_type banco:');
    const entryIdsSemRef = [...new Set(semRefBanco.map(i => i.entry?.id))];

    const { data: entriesSemRef } = await supabase
      .from('accounting_entries')
      .select('id, entry_date, description, entry_type, reference_type')
      .in('id', entryIdsSemRef);

    for (const e of entriesSemRef || []) {
      const item = semRefBanco.find(i => i.entry?.id === e.id);
      console.log(`  ${e.entry_date} | D: ${item?.debit || 0} C: ${item?.credit || 0} | ${e.entry_type} | ${e.description?.substring(0, 40)}`);
    }
  }
}

main().catch(console.error);
