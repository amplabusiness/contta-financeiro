// scripts/verificar_contas_despesas.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarContasDespesas() {
  // Buscar todas as contas do grupo 4 (Despesas)
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_synthetic, is_analytical, accepts_entries')
    .like('code', '4.%')
    .order('code');

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  console.log('='.repeat(80));
  console.log('CONTAS DE DESPESAS (GRUPO 4)');
  console.log('='.repeat(80));

  for (const conta of data) {
    const tipo = conta.is_synthetic ? 'SINTÉTICA' : (conta.is_analytical ? 'ANALÍTICA' : 'NORMAL');
    const aceita = conta.accepts_entries ? '✓' : '✗';
    console.log(`${conta.code.padEnd(15)} ${conta.name.substring(0,45).padEnd(45)} ${tipo.padEnd(12)} Aceita: ${aceita}`);
  }

  console.log('\nTotal de contas:', data.length);
  console.log('Sintéticas:', data.filter(c => c.is_synthetic).length);
  console.log('Analíticas:', data.filter(c => c.is_analytical || c.accepts_entries).length);
}

verificarContasDespesas();
