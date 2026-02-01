const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Tentando corrigir via SQL direto...');

  // A trigger está bloqueando UPDATE direto
  // Vamos tentar uma abordagem diferente: buscar os IDs e atualizar um a um
  
  const { data: pendentes, error: fetchError } = await supabase
    .from('bank_transactions')
    .select('id')
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421')
    .eq('status', 'pending')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .not('journal_entry_id', 'is', null);

  if (fetchError) {
    console.log('Erro ao buscar:', fetchError.message);
    return;
  }

  console.log('Encontradas:', pendentes?.length, 'transações');

  // Atualizar usando SQL raw via função postgres
  const sql = `
    UPDATE bank_transactions 
    SET status = 'reconciled', is_reconciled = true, reconciled_at = NOW()
    WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421' 
      AND status = 'pending' 
      AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
      AND journal_entry_id IS NOT NULL
  `;

  // Como a trigger está bloqueando, vou mostrar o SQL para executar manualmente
  console.log('\n=== SQL PARA EXECUTAR NO SUPABASE SQL EDITOR ===');
  console.log(sql);
  console.log('================================================\n');
})();
