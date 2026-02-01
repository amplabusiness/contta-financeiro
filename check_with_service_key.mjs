import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_KEY // Service key para bypass RLS
);
const t = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function main() {
  // 1. Contar linhas com service key
  const { count, error } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true });
  
  console.log('Total linhas (service key):', count);
  console.log('Erro:', error?.message);

  if (count > 0) {
    // Buscar amostra
    const { data: sample } = await supabase
      .from('accounting_entry_lines')
      .select('*')
      .limit(3);
    
    console.log('\nSample:');
    console.log(JSON.stringify(sample, null, 2));
  }

  // 2. Verificar direto no SQL via RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc('generate_monthly_audit_data', {
    p_tenant_id: t,
    p_year: 2025,
    p_month: 1
  });

  console.log('\n=== RPC Result ===');
  console.log('Transitória Débitos:', rpcData?.transitorias?.debitos);
  console.log('Transitória Créditos:', rpcData?.transitorias?.creditos);
}

main().catch(console.error);
