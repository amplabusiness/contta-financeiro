import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirVinculos() {
  // IDs dos agentes
  const victorId = 'cff165a2-e033-4b15-857b-2a300cf54a68';
  const nayaraId = '869e799f-7962-46bd-9108-e018ba6e04fd';

  // Lista correta de clientes (da planilha do Sérgio)
  const clientesHonorarios = [
    'AMAGU FESTAS',
    'ACAI DO MADRUGA',
    'SHARKSAPACE',
    'CARRO DE OURO',
    'OURO CAR',
    'STAR EMPORIO DE BEBIDAS',
    'JOHNANTHAN MACHADO'
  ];

  console.log('=== CORRIGINDO VÍNCULOS DE COMISSÃO ===\n');

  // 1. Remover TODOS os vínculos antigos
  console.log('1. Removendo vínculos antigos...');
  const { error: deleteError } = await supabase
    .from('client_commission_agents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta todos

  if (deleteError) {
    console.log('Erro ao deletar:', deleteError.message);
  } else {
    console.log('   ✓ Vínculos antigos removidos');
  }

  // 2. Buscar IDs dos clientes corretos
  console.log('\n2. Buscando clientes...');
  const { data: todosClientes } = await supabase
    .from('clients')
    .select('id, name')
    .eq('is_active', true);

  // Mapear clientes
  const clientesEncontrados = [];
  for (const nomeCliente of clientesHonorarios) {
    const cliente = todosClientes?.find(c => 
      c.name.toUpperCase().includes(nomeCliente.toUpperCase())
    );
    if (cliente) {
      clientesEncontrados.push(cliente);
      console.log(`   ✓ ${cliente.name}`);
    } else {
      console.log(`   ✗ NÃO ENCONTRADO: ${nomeCliente}`);
    }
  }

  // 3. Criar novos vínculos (50% Victor, 50% Nayara)
  console.log('\n3. Criando novos vínculos...');
  for (const cliente of clientesEncontrados) {
    // Vínculo com Victor (50%)
    const { error: e1 } = await supabase.from('client_commission_agents').insert({
      client_id: cliente.id,
      agent_id: victorId,
      percentage: 50.00,
      is_active: true,
      notes: 'Honorários mensais - 50%'
    });

    // Vínculo com Nayara (50%)
    const { error: e2 } = await supabase.from('client_commission_agents').insert({
      client_id: cliente.id,
      agent_id: nayaraId,
      percentage: 50.00,
      is_active: true,
      notes: 'Honorários mensais - 50%'
    });

    if (e1 || e2) {
      console.log(`   ✗ Erro em ${cliente.name}: ${e1?.message || e2?.message}`);
    } else {
      console.log(`   ✓ ${cliente.name} -> Victor 50% + Nayara 50%`);
    }
  }

  // 4. Verificar resultado final
  console.log('\n=== RESULTADO FINAL ===');
  const { data: vinculos } = await supabase
    .from('client_commission_agents')
    .select('client_id, percentage, clients(name), commission_agents(name)')
    .eq('is_active', true)
    .order('clients(name)');

  // Agrupar por cliente
  const porCliente = {};
  vinculos?.forEach(v => {
    const nome = v.clients?.name;
    if (!porCliente[nome]) porCliente[nome] = [];
    porCliente[nome].push({ agente: v.commission_agents?.name, pct: v.percentage });
  });

  Object.entries(porCliente).forEach(([cliente, agentes]) => {
    console.log(`${cliente}:`);
    agentes.forEach(a => console.log(`   - ${a.agente}: ${a.pct}%`));
  });

  console.log(`\nTotal: ${Object.keys(porCliente).length} clientes vinculados`);
}

corrigirVinculos();
