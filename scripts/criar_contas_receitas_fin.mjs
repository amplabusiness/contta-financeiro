// scripts/criar_contas_receitas_fin.mjs
// Criar contas de receitas financeiras se não existirem
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criar() {
  console.log('Verificando contas de receitas financeiras...');

  // Verificar se existe grupo 3.1.2
  let { data: grupo312 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '3.1.2')
    .single();

  if (!grupo312) {
    console.log('Criando grupo 3.1.2...');

    // Buscar pai 3.1
    const { data: pai31 } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '3.1')
      .single();

    if (!pai31) {
      console.log('Grupo 3.1 não existe, criando estrutura completa...');

      // Buscar grupo 3
      const { data: grupo3 } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '3')
        .single();

      if (grupo3) {
        const { data: novo31 } = await supabase
          .from('chart_of_accounts')
          .insert({
            code: '3.1',
            name: 'Receitas Operacionais',
            parent_id: grupo3.id,
            nature: 'CREDIT',
            is_synthetic: true
          })
          .select()
          .single();

        const { data: novo312 } = await supabase
          .from('chart_of_accounts')
          .insert({
            code: '3.1.2',
            name: 'Receitas Financeiras',
            parent_id: novo31.id,
            nature: 'CREDIT',
            is_synthetic: true
          })
          .select()
          .single();

        grupo312 = novo312;
        console.log('Criado: 3.1 e 3.1.2');
      }
    } else {
      const { data: novo312 } = await supabase
        .from('chart_of_accounts')
        .insert({
          code: '3.1.2',
          name: 'Receitas Financeiras',
          parent_id: pai31.id,
          nature: 'CREDIT',
          is_synthetic: true
        })
        .select()
        .single();

      grupo312 = novo312;
      console.log('Criado: 3.1.2');
    }
  }

  // Verificar conta 3.1.2.01 - Rendimentos Financeiros
  const { data: conta31201 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.2.01')
    .single();

  if (!conta31201 && grupo312) {
    await supabase.from('chart_of_accounts').insert({
      code: '3.1.2.01',
      name: 'Rendimentos de Aplicações Financeiras',
      parent_id: grupo312.id,
      nature: 'CREDIT',
      is_synthetic: false
    });
    console.log('Criado: 3.1.2.01 - Rendimentos de Aplicações Financeiras');
  }

  // Verificar conta 3.1.2.02 - Juros Recebidos
  const { data: conta31202 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.2.02')
    .single();

  if (!conta31202 && grupo312) {
    await supabase.from('chart_of_accounts').insert({
      code: '3.1.2.02',
      name: 'Juros Recebidos',
      parent_id: grupo312.id,
      nature: 'CREDIT',
      is_synthetic: false
    });
    console.log('Criado: 3.1.2.02 - Juros Recebidos');
  }

  // Verificar conta 3.1.2.03 - Descontos Obtidos
  const { data: conta31203 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.2.03')
    .single();

  if (!conta31203 && grupo312) {
    await supabase.from('chart_of_accounts').insert({
      code: '3.1.2.03',
      name: 'Descontos Obtidos',
      parent_id: grupo312.id,
      nature: 'CREDIT',
      is_synthetic: false
    });
    console.log('Criado: 3.1.2.03 - Descontos Obtidos');
  }

  console.log('Verificação concluída!');

  // Listar estrutura final
  const { data: final } = await supabase
    .from('chart_of_accounts')
    .select('code, name, is_synthetic')
    .like('code', '3.1.2%')
    .order('code');

  console.log('\nEstrutura 3.1.2.*:');
  for (const c of final || []) {
    console.log(`  ${c.code} - ${c.name} ${c.is_synthetic ? '[SINTÉTICA]' : ''}`);
  }
}

criar().catch(console.error);
