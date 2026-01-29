/**
 * TESTE: Verificar como fazer INSERT bypassing triggers
 */
require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testar() {
  console.log('Testando métodos de insert...\n');
  
  // Teste 1: Verificar se execute_sql existe
  console.log('1. Testando RPC execute_sql...');
  const { data: d1, error: e1 } = await supabase.rpc('execute_sql', { query: 'SELECT 1 as test' });
  console.log('  Resultado:', e1 ? `ERRO: ${e1.message}` : 'OK');
  
  // Teste 2: Listar funções RPC disponíveis
  console.log('\n2. Buscando funções RPC disponíveis...');
  const { data: funcs } = await supabase
    .from('pg_proc')
    .select('proname')
    .limit(5);
  console.log('  Funções:', funcs || 'N/A');

  // Teste 3: Tentar INSERT direto com options
  console.log('\n3. Testando INSERT com opções especiais...');
  
  // Primeiro, vamos ver a estrutura da trigger
  const { data: triggers } = await supabase.rpc('get_triggers_info');
  console.log('  Triggers:', triggers ? JSON.stringify(triggers).slice(0, 200) : 'N/A');
}

testar().catch(e => console.error('Erro:', e.message));
