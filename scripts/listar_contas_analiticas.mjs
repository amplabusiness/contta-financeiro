// Script para listar contas analíticas de despesa
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function listar() {
  // Buscar contas de despesa que são analíticas (não têm filhas)
  const { data: despesas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type')
    .like('code', '4%')
    .order('code');

  // Verificar quais são analíticas (não têm filhas)
  const codes = despesas?.map(d => d.code) || [];

  console.log('CONTAS DE DESPESA ANALÍTICAS (podem receber lançamentos):');
  console.log('═'.repeat(80));

  for (const d of despesas || []) {
    // Verificar se é analítica (nenhuma outra conta começa com seu código + .)
    const hasChildren = codes.some(c => c !== d.code && c.startsWith(d.code + '.'));
    if (!hasChildren) {
      console.log(`${d.code.padEnd(15)} | ${d.name}`);
    }
  }

  // Também buscar contas do ativo para adiantamentos
  console.log('\n\nCONTAS DE ATIVO (1.1.2.xx) - Para adiantamentos:');
  console.log('═'.repeat(80));

  const { data: ativos } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2%')
    .order('code');

  const codeAtivos = ativos?.map(a => a.code) || [];

  for (const a of ativos || []) {
    const hasChildren = codeAtivos.some(c => c !== a.code && c.startsWith(a.code + '.'));
    if (!hasChildren) {
      console.log(`${a.code.padEnd(15)} | ${a.name}`);
    }
  }

  // Passivo para empréstimos de sócios
  console.log('\n\nCONTAS DE PASSIVO (2.x) - Para empréstimos:');
  console.log('═'.repeat(80));

  const { data: passivos } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '2%')
    .order('code');

  const codePassivos = passivos?.map(p => p.code) || [];

  for (const p of passivos || []) {
    const hasChildren = codePassivos.some(c => c !== p.code && c.startsWith(p.code + '.'));
    if (!hasChildren) {
      console.log(`${p.code.padEnd(15)} | ${p.name}`);
    }
  }
}

listar().catch(console.error);
