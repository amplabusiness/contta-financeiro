import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ver transações de tarifas e seu status
const { data } = await supabase
  .from('bank_transactions')
  .select('id, transaction_date, description, amount, status, accounting_entry_id')
  .gte('transaction_date', '2025-01-01')
  .lte('transaction_date', '2025-01-31')
  .or('description.ilike.%TARIFA%,description.ilike.%MANUTENCAO DE TITULOS%,description.ilike.%CESTA DE RELACIONAMENTO%')
  .order('transaction_date');

console.log('Status das transações de tarifas:');
console.log('─'.repeat(100));

const porStatus = {};
for (const tx of data || []) {
  porStatus[tx.status] = (porStatus[tx.status] || 0) + 1;
  console.log(`[${tx.transaction_date}] ${tx.status.padEnd(12)} | ${tx.description?.substring(0, 50)}`);
}

console.log('─'.repeat(100));
console.log('Resumo por status:');
for (const [status, qtd] of Object.entries(porStatus)) {
  console.log(`  ${status}: ${qtd}`);
}
