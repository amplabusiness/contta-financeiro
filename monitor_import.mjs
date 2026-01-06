import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFebTransactions() {
  console.log('🔍 Listando as 10 transações mais recentes (para conferência)...');

  const { data, error, count } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Erro ao buscar transações:', error);
    return;
  }

  console.log(`📊 Total de transações no banco de dados: ${count}`);

  if (data && data.length > 0) {
    console.log('📝 Últimas transações inseridas:');
    data.forEach(tx => {
       console.log(`   - [Criado em: ${new Date(tx.created_at).toLocaleString()}] Data: ${tx.transaction_date} | ${tx.description} | R$ ${tx.amount} | ID: ${tx.internal_code}`);
    });
  } else {
    console.log('ℹ️ O banco de dados está vazio.');
  }
}

checkFebTransactions();

checkFebTransactions();
