// scripts/correcao_contabil/23_check_clients.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClients() {
  console.log('='.repeat(80));
  console.log('VERIFICAÇÃO DA TABELA CLIENTS');
  console.log('='.repeat(80));

  // Contar clientes
  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true });

  console.log('\nTotal de clientes na tabela:', count);

  if (count === 0) {
    console.log('\n⚠️  A TABELA CLIENTS ESTÁ VAZIA!');
    console.log('Os saldos de abertura referenciam clientes que não existem mais.');
    return;
  }

  // Buscar amostra
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, is_active')
    .limit(20);

  console.log('\nAmostra de clientes:');
  for (const c of clientes || []) {
    console.log(`  ${c.name?.substring(0, 40)} | R$ ${c.monthly_fee || 0} | ${c.is_active ? 'Ativo' : 'Inativo'}`);
  }

  // Verificar IDs dos saldos
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('client_id')
    .limit(100);

  const clientIds = [...new Set(saldos?.map(s => s.client_id) || [])];
  console.log('\nClient IDs únicos nos saldos:', clientIds.length);

  // Verificar quais existem
  let encontrados = 0;
  for (const id of clientIds) {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('id', id)
      .single();

    if (data) encontrados++;
  }

  console.log('Client IDs que existem na tabela clients:', encontrados);
  console.log('Client IDs órfãos (não existem):', clientIds.length - encontrados);
}

checkClients().catch(console.error);
