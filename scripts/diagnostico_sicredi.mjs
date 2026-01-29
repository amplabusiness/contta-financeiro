/**
 * DIAGNÓSTICO COMPLETO - BANCO SICREDI JANEIRO/2025
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

  console.log('═'.repeat(100));
  console.log('DIAGNÓSTICO COMPLETO - BANCO SICREDI JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');

  // 1. EXTRATO BANCÁRIO
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, transaction_type')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  let extratoEntradas = 0;
  let extratoSaidas = 0;
  const txCredito = [];
  const txDebito = [];

  for (const tx of extrato || []) {
    const valor = Math.abs(parseFloat(tx.amount));
    if (tx.transaction_type === 'credit') {
      extratoEntradas += valor;
      txCredito.push(tx);
    } else {
      extratoSaidas += valor;
      txDebito.push(tx);
    }
  }

  console.log('1. EXTRATO BANCÁRIO');
  console.log('-'.repeat(80));
  console.log(`   Transações de CRÉDITO (entradas): ${txCredito.length} = R$ ${extratoEntradas.toFixed(2)}`);
  console.log(`   Transações de DÉBITO (saídas):    ${txDebito.length} = R$ ${extratoSaidas.toFixed(2)}`);
  console.log(`   Total: ${extrato?.length || 0} transações`);
  console.log('');

  // 2. ENTRIES VINCULADOS A BANK_TRANSACTION
  const { data: entriesVinculados } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, reference_id')
    .eq('reference_type', 'bank_transaction')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log('2. ENTRIES VINCULADOS A TRANSAÇÕES BANCÁRIAS');
  console.log('-'.repeat(80));
  console.log(`   Total entries: ${entriesVinculados?.length || 0}`);

  // Verificar quais transações têm entry e quais não têm
  const txIdsComEntry = new Set((entriesVinculados || []).map(e => e.reference_id).filter(Boolean));
  const debitosSemEntry = txDebito.filter(tx => !txIdsComEntry.has(tx.id));
  const creditosSemEntry = txCredito.filter(tx => !txIdsComEntry.has(tx.id));

  console.log(`   Transações débito SEM entry: ${debitosSemEntry.length}`);
  console.log(`   Transações crédito SEM entry: ${creditosSemEntry.length}`);
  console.log('');

  // 3. ITEMS NA CONTA SICREDI
  const { data: itemsSicredi } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, credit, entry_id, entry:accounting_entries(entry_date, reference_type, reference_id)')
    .eq('account_id', contaSicrediId);

  const itemsJan = (itemsSicredi || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  let totalDebitos = 0;
  let totalCreditos = 0;

  for (const item of itemsJan) {
    totalDebitos += parseFloat(item.debit || 0);
    totalCreditos += parseFloat(item.credit || 0);
  }

  console.log('3. ITEMS NA CONTA SICREDI (Janeiro/2025)');
  console.log('-'.repeat(80));
  console.log(`   Total items: ${itemsJan.length}`);
  console.log(`   Débitos:  R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Créditos: R$ ${totalCreditos.toFixed(2)}`);
  console.log('');

  // 4. VERIFICAR ENTRIES QUE NÃO TÊM ITEM NA CONTA SICREDI
  const entryIdsComItemSicredi = new Set(itemsJan.map(i => i.entry_id));
  const entriesSemItemSicredi = (entriesVinculados || []).filter(e => !entryIdsComItemSicredi.has(e.id));

  console.log('4. ENTRIES SEM ITEM NA CONTA SICREDI');
  console.log('-'.repeat(80));
  console.log(`   Total: ${entriesSemItemSicredi.length}`);

  if (entriesSemItemSicredi.length > 0) {
    console.log('');
    console.log('   Detalhes:');
    for (const e of entriesSemItemSicredi.slice(0, 20)) {
      // Buscar items deste entry
      const { data: items } = await supabase
        .from('accounting_entry_items')
        .select('id, debit, credit, account:chart_of_accounts(code, name)')
        .eq('entry_id', e.id);

      console.log(`   - ${e.entry_date} | ${e.description?.substring(0, 50)}`);
      for (const item of items || []) {
        console.log(`     ${item.account?.code} D:${item.debit} C:${item.credit}`);
      }
    }
  }

  // 5. DIFERENÇAS
  console.log('');
  console.log('5. DIFERENÇAS');
  console.log('-'.repeat(80));
  console.log(`   Extrato Entradas:  R$ ${extratoEntradas.toFixed(2)}`);
  console.log(`   Contab Débitos:    R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Diferença:         R$ ${(extratoEntradas - totalDebitos).toFixed(2)}`);
  console.log('');
  console.log(`   Extrato Saídas:    R$ ${extratoSaidas.toFixed(2)}`);
  console.log(`   Contab Créditos:   R$ ${totalCreditos.toFixed(2)}`);
  console.log(`   Diferença:         R$ ${(extratoSaidas - totalCreditos).toFixed(2)}`);

  // 6. Listar transações sem entry
  if (debitosSemEntry.length > 0) {
    console.log('');
    console.log('6. TRANSAÇÕES DE DÉBITO (SAÍDA) SEM ENTRY:');
    console.log('-'.repeat(80));
    let totalSemEntry = 0;
    for (const tx of debitosSemEntry) {
      const valor = Math.abs(parseFloat(tx.amount));
      totalSemEntry += valor;
      console.log(`   ${tx.transaction_date} | R$ ${valor.toFixed(2).padStart(10)} | ${tx.description?.substring(0, 50)}`);
    }
    console.log(`   TOTAL: R$ ${totalSemEntry.toFixed(2)}`);
  }

  // 7. Verificar entries órfãos (sem transação no extrato)
  const extratoIds = new Set((extrato || []).map(t => t.id));
  const entriesOrfaos = (entriesVinculados || []).filter(e => e.reference_id && !extratoIds.has(e.reference_id));

  if (entriesOrfaos.length > 0) {
    console.log('');
    console.log('7. ENTRIES ÓRFÃOS (reference_id não existe no extrato):');
    console.log('-'.repeat(80));
    console.log(`   Total: ${entriesOrfaos.length}`);
    for (const e of entriesOrfaos.slice(0, 10)) {
      console.log(`   - ${e.entry_date} | ${e.description?.substring(0, 50)} | ref: ${e.reference_id}`);
    }
  }
}

main().catch(console.error);
