/**
 * CHECK DIFERENÇA DE R$ 331,44
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
  // Buscar conta Banco Sicredi
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  // Buscar todas as transações de saída
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount')
    .eq('transaction_type', 'debit')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  // Buscar entries vinculados a bank_transactions
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, reference_id')
    .eq('reference_type', 'bank_transaction')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const idsComEntry = new Set((entries || []).map(e => e.reference_id).filter(Boolean));

  // Encontrar transações sem entry
  const semEntry = (extrato || []).filter(tx => {
    return !idsComEntry.has(tx.id);
  });

  console.log('TRANSAÇÕES DE SAÍDA SEM LANÇAMENTO CONTÁBIL:');
  console.log('-'.repeat(80));

  let total = 0;
  for (const tx of semEntry) {
    const valor = Math.abs(parseFloat(tx.amount));
    total += valor;
    console.log(`${tx.transaction_date} | R$ ${valor.toFixed(2).padStart(10)} | ${tx.description.substring(0, 50)}`);
  }

  console.log('-'.repeat(80));
  console.log(`Total: ${semEntry.length} transações = R$ ${total.toFixed(2)}`);

  // Verificar também o inverso: entries sem transação
  console.log('');
  console.log('LANÇAMENTOS SEM TRANSAÇÃO BANCÁRIA CORRESPONDENTE:');
  console.log('-'.repeat(80));

  const { data: todosCreditos } = await supabase
    .from('accounting_entry_items')
    .select(`
      id, credit,
      entry:accounting_entries!inner(id, entry_date, description, reference_type, reference_id)
    `)
    .eq('account_id', contaSicredi.id)
    .gt('credit', 0);

  const creditosJan = (todosCreditos || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  const extratoIds = new Set((extrato || []).map(t => t.id));

  const creditosSemTx = creditosJan.filter(item => {
    const refType = item.entry?.reference_type;
    const refId = item.entry?.reference_id;
    return refType !== 'bank_transaction' || !refId || !extratoIds.has(refId);
  });

  let totalSemTx = 0;
  for (const item of creditosSemTx) {
    totalSemTx += parseFloat(item.credit) || 0;
    console.log(`R$ ${parseFloat(item.credit).toFixed(2).padStart(10)} | ${item.entry?.description?.substring(0, 60)}`);
  }

  console.log('-'.repeat(80));
  console.log(`Total: ${creditosSemTx.length} lançamentos = R$ ${totalSemTx.toFixed(2)}`);
}

main().catch(console.error);
