import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('='.repeat(100));
  console.log('INVESTIGACAO: ESTRUTURA DO BANCO DE DADOS - BOLETOS E RECEBIMENTOS');
  console.log('='.repeat(100));

  // 1. bank_transactions structure
  console.log('\nTABELA: bank_transactions');
  console.log('-'.repeat(100));
  let response = await supabase.table('bank_transactions').select('*').limit(1);
  if (response.data && response.data.length > 0) {
    const cols = Object.keys(response.data[0]);
    console.log('Total de colunas:', cols.length);
    cols.forEach((col, i) => {
      console.log((i+1)+'. '+col);
    });
  }

  // 2. accounting_entries structure
  console.log('\n\nTABELA: accounting_entries');
  console.log('-'.repeat(100));
  response = await supabase.table('accounting_entries').select('*').limit(1);
  if (response.data && response.data.length > 0) {
    const cols = Object.keys(response.data[0]);
    console.log('Total de colunas:', cols.length);
    cols.forEach((col, i) => {
      console.log((i+1)+'. '+col);
    });
  }

  // 3. accounting_entry_lines structure
  console.log('\n\nTABELA: accounting_entry_lines');
  console.log('-'.repeat(100));
  response = await supabase.table('accounting_entry_lines').select('*').limit(1);
  if (response.data && response.data.length > 0) {
    const cols = Object.keys(response.data[0]);
    console.log('Total de colunas:', cols.length);
    cols.forEach((col, i) => {
      console.log((i+1)+'. '+col);
    });
  }

  // 4. Check boleto_payments
  console.log('\n\nTABELA: boleto_payments');
  console.log('-'.repeat(100));
  try {
    response = await supabase.table('boleto_payments').select('*').limit(1);
    if (response.data && response.data.length > 0) {
      const cols = Object.keys(response.data[0]);
      console.log('Total de colunas:', cols.length);
      cols.forEach((col, i) => {
        console.log((i+1)+'. '+col);
      });
    } else if (response.error) {
      console.log('ERRO: '+response.error.message);
    } else {
      console.log('Tabela existe mas vazia ou sem permissao');
    }
  } catch (e) {
    console.log('ERRO:', e.message);
  }

  // 5. COB transactions February 2025
  console.log('\n\nTRANSACOES COM "COB" - FEVEREIRO 2025');
  console.log('-'.repeat(100));
  response = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, bank_account_id, journal_entry_id, internal_code')
    .ilike('description', '%COB%')
    .gte('transaction_date', '2025-02-01')
    .lte('transaction_date', '2025-02-28')
    .order('transaction_date', { ascending: false })
    .limit(15);

  if (response.data) {
    console.log('Encontradas ' + response.data.length + ' transacoes:\n');
    response.data.slice(0, 10).forEach((tx, i) => {
      console.log('[' + (i+1) + '] ' + tx.transaction_date + ' - ' + tx.description.substring(0, 60));
      console.log('    Valor: ' + tx.amount + ' | Amount Account: ' + (tx.bank_account_id ? tx.bank_account_id.substring(0, 12) + '...' : 'N/A'));
      console.log('    Internal Code: ' + tx.internal_code + ' | Journal ID: ' + (tx.journal_entry_id ? tx.journal_entry_id.substring(0, 12) + '...' : 'N/A'));
      console.log('');
    });
  }

  // 6. Example: COB000002
  console.log('\nEXEMPLO DETALHADO: COB000002');
  console.log('-'.repeat(100));
  response = await supabase
    .from('bank_transactions')
    .select('*')
    .ilike('description', '%COB000002%')
    .limit(1);

  if (response.data && response.data.length > 0) {
    const tx = response.data[0];
    console.log('Transacao Bancaria:');
    console.log('  ID: ' + tx.id.substring(0, 20) + '...');
    console.log('  Data: ' + tx.transaction_date);
    console.log('  Descricao: ' + tx.description);
    console.log('  Valor: ' + tx.amount);
    console.log('  Internal Code: ' + tx.internal_code);
    console.log('  Journal Entry ID: ' + (tx.journal_entry_id ? tx.journal_entry_id.substring(0, 20) + '...' : 'N/A'));

    // Get accounting entry
    if (tx.journal_entry_id) {
      const entryResp = await supabase
        .from('accounting_entries')
        .select('*, accounting_entry_lines(*)')
        .eq('id', tx.journal_entry_id);

      if (entryResp.data && entryResp.data.length > 0) {
        const entry = entryResp.data[0];
        console.log('\nLancamento Contabil Encontrado:');
        console.log('  ID: ' + entry.id.substring(0, 20) + '...');
        console.log('  Data: ' + entry.entry_date);
        console.log('  Tipo: ' + entry.entry_type);
        console.log('  Descricao: ' + entry.description);
        console.log('  Linhas de Lancamento:');
        if (entry.accounting_entry_lines) {
          entry.accounting_entry_lines.forEach((line, idx) => {
            console.log('    [' + (idx+1) + '] Conta: ' + line.account_code);
            console.log('        Debito: ' + line.debit_amount + ' | Credito: ' + line.credit_amount);
          });
        }
      }
    }
  } else {
    console.log('COB000002 nao encontrado');
  }

  console.log('\n' + '='.repeat(100));
}

main().catch(err => {
  console.error('ERRO FATAL:', err.message);
  process.exit(1);
});
