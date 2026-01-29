require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Buscar contas de clientes (1.1.2.01.xxxx)
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421')
    .order('code');
  
  console.log('Contas de clientes (1.1.2.01.xxxx):');
  console.log('Total:', contas?.length || 0);
  
  // Mostrar algumas para entender o padrão
  if (contas) {
    for (const c of contas.slice(0, 10)) {
      console.log(`  ${c.code} - ${c.name}`);
    }
  }

  // Buscar clientes com saldo pendente
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select(`
      id,
      client_id,
      competence,
      amount,
      clients!inner(id, name, code)
    `)
    .eq('status', 'pending')
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421')
    .limit(10);
  
  console.log('\n\nClientes com saldo pendente:');
  if (saldos) {
    for (const s of saldos) {
      console.log(`  ${s.clients.code || 'sem código'} - ${s.clients.name} (R$ ${s.amount})`);
    }
  }
}

main();
