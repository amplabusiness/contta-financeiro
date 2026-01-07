
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(supabaseUrl, supabaseKey);

async function search() {
  console.log('--- Buscando Clientes ---');
  const { data: clients } = await sb.from('financial_customers').select('id, name').or('name.ilike.%Lajes Morada%,name.ilike.%JPL%');
  console.log('Clientes encontrados:', clients);

  console.log('\n--- Buscando Transações de 1.138,00 ---');
  const amount = 1138.00;
  
  // Buscar no bank_transactions
  const { data: bankTx, error: bankError } = await sb.from('bank_transactions')
    .select('transaction_date, description, amount')
    .or(`amount.eq.${amount},amount.eq.-${amount}`);
    
  console.log('--- Extrato Bancário ---');
  if (bankError) console.error(bankError);
  if (bankTx && bankTx.length) {
      bankTx.forEach(tx => console.log(`[BANK] ${tx.transaction_date} | ${tx.amount} | ${tx.description}`));
  } else {
      console.log('Nada no extrato com esse valor.');
  }

  // Buscar em accounting_entry_lines
  const { data: lines, error: ledgerError } = await sb.from('accounting_entry_lines')
    .select('debit, credit, accounting_entries(id, entry_date, description, history)')
    .or(`debit.eq.${amount},credit.eq.${amount}`);

  console.log('\n--- Livro Razão ---');
  if (ledgerError) console.error(ledgerError);
  if (lines && lines.length) {
      lines.forEach(l => {
          const val = l.debit || l.credit;
          const entry = l.accounting_entries;
          if(entry) {
             console.log(`[LEDGER] ${entry.entry_date} | ${val} | Desc: ${entry.description} | Hist: ${entry.history}`);
          }
      });
  } else {
      console.log('Nada no razão com esse valor.');
  }
}

search();
