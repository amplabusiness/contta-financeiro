
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEconet() {
  console.log('Verificando classificação da Econet...');

  // 1. Buscar transação da Econet em Fev
  const { data: txs } = await supabase
    .from('bank_transactions')
    .select('id, description, amount, transaction_type, journal_entry_id')
    .ilike('description', '%ECONET%')
    .gte('transaction_date', '2025-02-01')
    .limit(1);

  if (!txs || txs.length === 0) {
      console.log('Nenhuma transação da Econet encontrada em Fev.');
      return;
  }

  const tx = txs[0];
  console.log('Transação:', tx.description);

  if (!tx.journal_entry_id) {
      console.log('❌ Sem lançamento contábil vinculado.');
      return;
  }

  // 2. Buscar linhas do lançamento
  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select('description, debit, credit')
    .eq('entry_id', tx.journal_entry_id)
    .gt('debit', 0); // Pegar a linha de débito (onde entra a despesa)

  console.log('Linha de Débito (Despesa):', lines);

  const isCorrect = lines.some(l => l.description.includes('Assinaturas Econet'));

  if (isCorrect) {
      console.log('✅ SUCESSO! Classificado como "Assinaturas Econet".');
  } else {
      console.log('❌ FALHA! Ainda está caindo na conta errada.');
  }
}

checkEconet();
