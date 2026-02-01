import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const t = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function main() {
  // 1. Verificar estrutura de accounting_entries
  const { data: sample } = await s
    .from('accounting_entries')
    .select('*')
    .eq('tenant_id', t)
    .limit(1);

  if (sample?.[0]) {
    console.log('=== ESTRUTURA DE accounting_entries ===');
    console.log('Colunas:', Object.keys(sample[0]).join(', '));
    console.log('\nSample:');
    console.log(JSON.stringify(sample[0], null, 2));
  }

  // 2. Contar por source_type
  const { data: all } = await s
    .from('accounting_entries')
    .select('source_type, debit_account_id, credit_account_id, amount')
    .eq('tenant_id', t)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log('\n=== TOTAL JANEIRO 2025 ===');
  console.log('Lançamentos:', all?.length);

  // 3. Verificar movimentação nas transitórias
  const TRANS_DEB = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
  const TRANS_CRED = '28085461-9e5a-4fb4-847d-c9fc047fe0a1';

  let debDebito = 0, debCredito = 0;
  let credDebito = 0, credCredito = 0;

  all?.forEach(e => {
    // Débito na conta
    if (e.debit_account_id === TRANS_DEB) debDebito += e.amount || 0;
    if (e.debit_account_id === TRANS_CRED) credDebito += e.amount || 0;
    
    // Crédito na conta
    if (e.credit_account_id === TRANS_DEB) debCredito += e.amount || 0;
    if (e.credit_account_id === TRANS_CRED) credCredito += e.amount || 0;
  });

  console.log('\n=== TRANSITÓRIAS ===');
  console.log('1.1.9.01 (Débitos Pendentes):');
  console.log('  Débitos:', debDebito.toFixed(2));
  console.log('  Créditos:', debCredito.toFixed(2));
  console.log('  Saldo:', (debDebito - debCredito).toFixed(2));

  console.log('\n2.1.9.01 (Créditos Pendentes):');
  console.log('  Débitos:', credDebito.toFixed(2));
  console.log('  Créditos:', credCredito.toFixed(2));
  console.log('  Saldo:', (credCredito - credDebito).toFixed(2));
}

main().catch(console.error);
