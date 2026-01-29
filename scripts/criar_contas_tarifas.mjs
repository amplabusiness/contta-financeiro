// scripts/criar_contas_tarifas.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarContas() {
  console.log('Criando estrutura de contas para despesas financeiras...');

  // Verificar se existe grupo 4.1.3 para despesas financeiras
  let { data: grupo413 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4.1.3')
    .single();

  if (!grupo413) {
    // Buscar pai 4.1
    const { data: pai41 } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '4.1')
      .single();

    if (pai41) {
      const { data: novo413 } = await supabase
        .from('chart_of_accounts')
        .insert({
          code: '4.1.3',
          name: 'Despesas Financeiras',
          parent_id: pai41.id,
          nature: 'DEBIT',
          is_synthetic: true
        })
        .select()
        .single();

      grupo413 = novo413;
      console.log('Criado: 4.1.3 - Despesas Financeiras');
    }
  } else {
    console.log('Já existe: 4.1.3');
  }

  // Criar subgrupo 4.1.3.01 - Tarifas Bancárias
  let { data: grupo41301 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4.1.3.01')
    .single();

  if (!grupo41301 && grupo413) {
    const { data: novo41301 } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: '4.1.3.01',
        name: 'Tarifas Bancárias',
        parent_id: grupo413.id,
        nature: 'DEBIT',
        is_synthetic: true
      })
      .select()
      .single();

    grupo41301 = novo41301;
    console.log('Criado: 4.1.3.01 - Tarifas Bancárias');
  } else if (grupo41301) {
    console.log('Já existe: 4.1.3.01');
  }

  // Criar contas analíticas
  if (grupo41301) {
    const contasAnaliticas = [
      { code: '4.1.3.01.0001', name: 'Tarifas Bancárias Gerais' },
      { code: '4.1.3.01.0002', name: 'Tarifas Cobrança Sicredi' },
      { code: '4.1.3.01.0003', name: 'Manutenção de Títulos' }
    ];

    for (const c of contasAnaliticas) {
      const { data: existe } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', c.code)
        .single();

      if (!existe) {
        await supabase.from('chart_of_accounts').insert({
          code: c.code,
          name: c.name,
          parent_id: grupo41301.id,
          nature: 'DEBIT',
          is_synthetic: false
        });
        console.log(`Criado: ${c.code} - ${c.name}`);
      } else {
        console.log(`Já existe: ${c.code}`);
      }
    }
  }

  // Listar resultado
  const { data: final } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .like('code', '4.1.3%')
    .order('code');

  console.log('\nEstrutura final 4.1.3.*:');
  for (const c of final || []) {
    console.log(`  ${c.code} - ${c.name}`);
  }
}

criarContas().catch(console.error);
