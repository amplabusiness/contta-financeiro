
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('🔍 Verificando dados de Fevereiro 2025...');
  
  const startOfMonth = '2025-02-01';
  const endOfMonth = '2025-02-28';

  // 1. Check counts
  const { count, error: countError } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('transaction_date', startOfMonth)
    .lte('transaction_date', endOfMonth);

  console.log(`📊 Total de transações em Fev/2025: ${count} (Erro: ${countError?.message})`);

  // 2. Check matched status
  const { count: pendingCount } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('transaction_date', startOfMonth)
    .lte('transaction_date', endOfMonth)
    .eq('matched', false);
    
  console.log(`⏳ Pendentes (matched=false): ${pendingCount}`);

  // 3. Sample Date Format
  const { data: sample } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, matched')
    .gte('transaction_date', startOfMonth)
    .limit(1);

  if (sample && sample.length > 0) {
      console.log('📝 Exemplo:', sample[0]);
  } else {
      console.log('⚠️ Nenhuma transação encontrada no intervalo.');
  }

}

checkData();
