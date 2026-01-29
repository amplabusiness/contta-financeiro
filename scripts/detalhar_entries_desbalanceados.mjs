// Script para detalhar entries desbalanceados
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function detalhar() {
  console.log('Detalhando entries desbalanceados de bank_transaction...\n');

  // Buscar entries de bank_transaction
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      description,
      source_type,
      source_id,
      items:accounting_entry_items(
        id,
        debit,
        credit,
        history,
        account:chart_of_accounts(code, name)
      )
    `)
    .eq('source_type', 'bank_transaction')
    .eq('is_draft', false)
    .order('entry_date', { ascending: false })
    .limit(10);

  if (error) {
    console.log(`Erro: ${error.message}`);
    return;
  }

  for (const entry of entries || []) {
    const totalDebit = entry.items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const totalCredit = entry.items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    console.log('─'.repeat(80));
    console.log(`Entry ID: ${entry.id}`);
    console.log(`Data: ${entry.entry_date}`);
    console.log(`Descrição: ${entry.description}`);
    console.log(`Source ID: ${entry.source_id}`);
    console.log(`Status: ${isBalanced ? '✅ Balanceado' : '⚠️ DESBALANCEADO'}`);
    console.log(`\nItems (${entry.items?.length || 0}):`);

    for (const item of entry.items || []) {
      const tipo = Number(item.debit) > 0 ? 'D' : 'C';
      const valor = Number(item.debit) > 0 ? item.debit : item.credit;
      console.log(`  ${tipo}: R$ ${Number(valor).toFixed(2).padStart(10)} | ${item.account?.code} - ${item.account?.name}`);
    }

    console.log(`\nTotal D: R$ ${totalDebit.toFixed(2)} | Total C: R$ ${totalCredit.toFixed(2)}`);
  }

  // Verificar se existe a bank_transaction correspondente
  console.log('\n\nVerificando transações bancárias fonte...');
  const sampleEntry = entries?.[0];
  if (sampleEntry?.source_id) {
    const { data: bankTx, error: bankError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', sampleEntry.source_id)
      .single();

    if (bankError) {
      console.log(`Erro ao buscar transação: ${bankError.message}`);
    } else if (bankTx) {
      console.log('\nTransação bancária fonte:');
      console.log(`  ID: ${bankTx.id}`);
      console.log(`  Data: ${bankTx.transaction_date}`);
      console.log(`  Descrição: ${bankTx.description}`);
      console.log(`  Valor: R$ ${bankTx.amount}`);
      console.log(`  Tipo: ${bankTx.type}`);
      console.log(`  Rubrica ID: ${bankTx.rubrica_id}`);
      console.log(`  Account ID: ${bankTx.account_id}`);
      console.log(`  Status: ${bankTx.status}`);
    }
  }

  // Verificar o trigger de bank_transaction
  console.log('\n\nAnalisando padrão dos entries desbalanceados...');
  const { data: allDesbal } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      items:accounting_entry_items(
        debit,
        credit,
        account:chart_of_accounts(code)
      )
    `)
    .eq('source_type', 'bank_transaction')
    .eq('is_draft', false);

  const desbalanceados = (allDesbal || []).filter(e => {
    const d = e.items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const c = e.items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    return Math.abs(d - c) > 0.01;
  });

  console.log(`Total desbalanceados: ${desbalanceados.length}`);

  // Ver quais contas estão sendo usadas
  const contasUsadas = {};
  for (const e of desbalanceados) {
    for (const item of e.items || []) {
      const code = item.account?.code || 'sem_conta';
      if (!contasUsadas[code]) contasUsadas[code] = { debit: 0, credit: 0 };
      contasUsadas[code].debit += Number(item.debit || 0);
      contasUsadas[code].credit += Number(item.credit || 0);
    }
  }

  console.log('\nContas usadas nos entries desbalanceados:');
  for (const [code, vals] of Object.entries(contasUsadas)) {
    console.log(`  ${code}: D=${vals.debit.toFixed(2)} | C=${vals.credit.toFixed(2)}`);
  }
}

detalhar().catch(console.error);
