import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('get_table_triggers', { 
    p_table_name: 'accounting_entries' 
  });
  console.log('Triggers:', data, error);
}

async function checkSimpleInsert() {
  const { data, error } = await supabase
    .from('accounting_entries')
    .insert({
      tenant_id: 'a53a4957-fe97-4856-b3ca-70045157b421',
      entry_date: '2025-01-28',
      competence_date: '2025-01-28',
      entry_type: 'NORMAL',
      description: 'TESTE SIMPLES',
      internal_code: 'TESTE_DELETE_' + Date.now(),
      total_debit: 100,
      total_credit: 100,
      balanced: true
    })
    .select();
  
  console.log('Insert result:', error ? error.message : 'OK', data);
  
  // Se criou, deletar
  if (data && data[0]) {
    const { error: delErr } = await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', data[0].id);
    console.log('Delete:', delErr ? delErr.message : 'OK');
  }
}

checkSimpleInsert();
