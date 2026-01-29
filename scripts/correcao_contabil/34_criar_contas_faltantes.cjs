// scripts/correcao_contabil/34_criar_contas_faltantes.cjs
// Cria contas analíticas para clientes que não têm

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarContasFaltantes() {
  const clientesFaltantes = [
    '692166ce-e85d-4436-9714-07fc9891c315',
    '6ea8cafa-3780-4fe0-a77e-366ce406a4cf'
  ];

  // Buscar próximo código disponível
  const { data: ultimaConta } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .like('code', '1.1.2.01.%')
    .order('code', { ascending: false })
    .limit(1);

  let proximoCodigo = 10008;
  if (ultimaConta && ultimaConta.length > 0) {
    const ultimo = ultimaConta[0].code.split('.').pop();
    proximoCodigo = parseInt(ultimo) + 1;
  }

  console.log('Proximo codigo disponivel:', proximoCodigo);

  // Buscar ID da conta pai (1.1.2.01)
  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  for (const clienteId of clientesFaltantes) {
    // Buscar nome do cliente
    const { data: cliente } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clienteId)
      .single();

    if (cliente === null) {
      console.log('Cliente não encontrado:', clienteId);
      continue;
    }

    const codigo = '1.1.2.01.' + String(proximoCodigo).padStart(4, '0');
    const nome = 'Cliente: ' + cliente.name;

    console.log('Criando conta:', codigo, '|', nome);

    const { error } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: codigo,
        name: nome,
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        parent_id: contaPai.id,
        level: 5,
        is_analytical: true,
        is_synthetic: false,
        is_active: true,
        accepts_entries: true
      });

    if (error) {
      console.log('  ERRO:', error.message);
    } else {
      console.log('  OK');
      proximoCodigo++;
    }
  }

  // Agora rodar os lançamentos faltantes
  console.log('\nAgora execute novamente o script 33 para criar os lançamentos faltantes.');
}

criarContasFaltantes().catch(console.error);
