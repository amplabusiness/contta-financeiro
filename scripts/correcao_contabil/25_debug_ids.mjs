// scripts/correcao_contabil/25_debug_ids.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debug() {
  // 1. Buscar um saldo
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .limit(3);

  console.log('Saldos:');
  for (const s of saldos || []) {
    console.log('  ID:', s.id);
    console.log('  Client ID:', s.client_id, '(tipo:', typeof s.client_id, ')');
    console.log('  Competencia:', s.competence);
    console.log('  Valor:', s.amount);
    console.log('');

    // Tentar buscar este cliente específico
    const { data: cliente, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', s.client_id)
      .single();

    if (error) {
      console.log('  ERRO ao buscar cliente:', error.message);
    } else if (cliente) {
      console.log('  CLIENTE ENCONTRADO:', cliente.name);
    } else {
      console.log('  CLIENTE NÃO ENCONTRADO');
    }
    console.log('-'.repeat(60));
  }

  // 2. Buscar clientes com algum filtro
  console.log('\nBuscando 3 clientes:');
  const { data: clientes, error: errClientes } = await supabase
    .from('clients')
    .select('id, name')
    .limit(3);

  if (errClientes) {
    console.log('Erro:', errClientes);
  }

  for (const c of clientes || []) {
    console.log('  ID:', c.id, '| Nome:', c.name);
  }
}

debug().catch(console.error);
