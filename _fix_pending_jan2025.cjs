const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Usar service role para bypass de RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);
const tenantId = 'a53a4957-fe97-4856-b3ca-70045157b421';

(async () => {
  console.log('Atualizando status das transações pendentes de Jan/2025...');

  const { data, error } = await supabase
    .from('bank_transactions')
    .update({ 
      status: 'reconciled', 
      is_reconciled: true,
      reconciled_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .not('journal_entry_id', 'is', null)
    .select('id');

  if (error) {
    console.log('ERRO:', error.message);
  } else {
    console.log('✅ Atualizadas:', data?.length, 'transações para status "reconciled"');
  }

  // Verificar resultado
  const { data: check } = await supabase
    .from('bank_transactions')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  console.log('Transações ainda pendentes:', check?.length || 0);
})();
