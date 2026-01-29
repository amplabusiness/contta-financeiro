require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Verificar estrutura de chart_of_accounts
  const { data: coa } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .like('code', '1.1.2.01.%')
    .limit(1);
  
  console.log('Colunas chart_of_accounts:');
  if (coa && coa[0]) {
    console.log(Object.keys(coa[0]).join(', '));
  }

  // Verificar estrutura de client_opening_balance
  const { data: cob } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('status', 'pending')
    .limit(1);
  
  console.log('\nColunas client_opening_balance:');
  if (cob && cob[0]) {
    console.log(Object.keys(cob[0]).join(', '));
  }

  // Verificar mapeamento existente
  const { data: map } = await supabase
    .from('client_account_mapping')
    .select('*')
    .limit(1);
  
  console.log('\nExiste client_account_mapping?', map ? 'SIM' : 'NAO');
  if (map && map[0]) {
    console.log('Colunas:', Object.keys(map[0]).join(', '));
  }
}

main();
