require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Buscar clientes com saldo pendente E suas possíveis contas
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select(`
      id,
      client_id,
      competence,
      amount,
      clients!inner(id, name)
    `)
    .eq('status', 'pending')
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421');
  
  console.log('Saldos pendentes:', saldos?.length || 0);
  
  // Para cada cliente com saldo, buscar conta correspondente pelo nome
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421');
  
  console.log('Contas 1.1.2.01.x:', contas?.length || 0);
  
  // Criar mapa de nome -> conta (normalizado)
  const mapaContas = new Map();
  for (const c of contas || []) {
    const nomeNorm = c.name.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    mapaContas.set(nomeNorm, c);
  }
  
  // Verificar quantos clientes têm correspondência
  let comConta = 0;
  let semConta = 0;
  const clientesSemConta = [];
  
  for (const s of saldos || []) {
    const nomeCliente = s.clients.name.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const conta = mapaContas.get(nomeCliente);
    
    if (conta) {
      comConta++;
    } else {
      semConta++;
      clientesSemConta.push({ nome: s.clients.name, valor: s.amount });
    }
  }
  
  console.log('\nMapeamento por nome:');
  console.log('  Com conta correspondente:', comConta);
  console.log('  SEM conta:', semConta);
  
  if (clientesSemConta.length > 0 && clientesSemConta.length <= 20) {
    console.log('\nClientes sem conta:');
    for (const c of clientesSemConta) {
      console.log(`  - ${c.nome} (R$ ${c.valor})`);
    }
  }
}

main();
