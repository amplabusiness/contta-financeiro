
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Verificando status da correção...');

  // Pegar uma transação de SAÍDA (Debit)
  const { data: txs } = await supabase
    .from('bank_transactions')
    .select('id, description, amount, transaction_type, journal_entry_id')
    .eq('transaction_type', 'debit')
    .gte('transaction_date', '2025-02-01')
    .limit(1);

  if (!txs || txs.length === 0) {
      console.log('Nenhuma transação de débito encontrada para testar.');
      return;
  }

  const tx = txs[0];
  console.log('Transação Analisada:', tx.description, '(', tx.amount, ')');

  if (!tx.journal_entry_id) {
      console.log('❌ journal_entry_id é NULL. O script de regeneração precisa rodar.');
      return;
  }

  // Pegar as linhas contábeis dessa transação
  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select('description, debit, credit')
    .eq('entry_id', tx.journal_entry_id);

  console.log('Linhas Contábeis:', JSON.stringify(lines, null, 2));

  // Verificar lógica
  // Para um débito bancário (saída), esperamos:
  // 1. Uma linha com CRÉDITO na conta Banco (ou Clientes se fosse lógica antiga errada)
  // 2. Uma linha com DÉBITO na conta Despesa
  
  const hasCreditInBank = lines.some(l => l.credit > 0 && (l.description.includes('Banco') || l.description.includes('Conta')));
  const hasDebitInExpense = lines.some(l => l.debit > 0);

  if (hasCreditInBank) {
      console.log('✅ SUCESSO! A lógica está correta (Crédito no Banco para saída).');
  } else {
      console.log('⚠️ AVISO: A lógica parece ANTIGA (Possivelmente Débito no Banco?). Precisa limpar e regenerar.');
  }
}

check();
