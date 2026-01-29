// scripts/verificar_contas_ofx.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(80));
  console.log('VERIFICAÇÃO DE CONTAS PARA PROCESSAMENTO OFX');
  console.log('='.repeat(80));

  // Verificar contas de despesas financeiras
  const { data: contasDespFin } = await supabase
    .from('chart_of_accounts')
    .select('code, name, is_synthetic')
    .like('code', '4.1.2%')
    .order('code');

  console.log('\n📊 Contas de despesas financeiras (4.1.2.*)');
  for (const c of contasDespFin || []) {
    console.log(`   ${c.code} - ${c.name} ${c.is_synthetic ? '[SINTÉTICA]' : ''}`);
  }

  // Verificar conta transitória
  const { data: transitoria } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .eq('code', '1.1.9.01')
    .single();

  console.log('\n📊 Conta Transitória:');
  console.log(transitoria ? `   ${transitoria.code} - ${transitoria.name}` : '   NÃO ENCONTRADA');

  // Verificar Banco Sicredi
  const { data: banco } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .eq('code', '1.1.1.02')
    .single();

  console.log('\n📊 Banco Sicredi:');
  console.log(banco ? `   ${banco.code} - ${banco.name}` : '   NÃO ENCONTRADA');

  // Verificar conta de rendimentos
  const { data: rendimentos } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .like('code', '3.1.2%')
    .order('code');

  console.log('\n📊 Contas de receitas financeiras (3.1.2.*)');
  for (const c of rendimentos || []) {
    console.log(`   ${c.code} - ${c.name}`);
  }

  // Verificar se precisamos criar contas faltantes
  const contasFaltantes = [];

  // Conta de tarifas bancárias genérica
  const { data: tarifaGen } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4.1.2.01.0001')
    .single();

  if (!tarifaGen) {
    contasFaltantes.push({ code: '4.1.2.01.0001', name: 'Tarifas Bancárias Gerais' });
  }

  // Conta de tarifas cobrança
  const { data: tarifaCob } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4.1.2.01.0002')
    .single();

  if (!tarifaCob) {
    contasFaltantes.push({ code: '4.1.2.01.0002', name: 'Tarifas Cobrança Sicredi' });
  }

  if (contasFaltantes.length > 0) {
    console.log('\n⚠️  CONTAS FALTANTES - CRIANDO...');

    // Buscar conta pai
    const { data: contaPai } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '4.1.2.01')
      .single();

    if (!contaPai) {
      // Criar conta pai primeiro
      const { data: grupo412 } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '4.1.2')
        .single();

      if (grupo412) {
        const { data: novaPai } = await supabase
          .from('chart_of_accounts')
          .insert({
            code: '4.1.2.01',
            name: 'Despesas Bancárias',
            parent_id: grupo412.id,
            nature: 'DEBIT',
            is_synthetic: true
          })
          .select()
          .single();

        console.log(`   ✅ Criada conta pai: 4.1.2.01 - Despesas Bancárias`);

        for (const conta of contasFaltantes) {
          await supabase.from('chart_of_accounts').insert({
            code: conta.code,
            name: conta.name,
            parent_id: novaPai.id,
            nature: 'DEBIT',
            is_synthetic: false
          });
          console.log(`   ✅ Criada: ${conta.code} - ${conta.name}`);
        }
      }
    } else {
      for (const conta of contasFaltantes) {
        await supabase.from('chart_of_accounts').insert({
          code: conta.code,
          name: conta.name,
          parent_id: contaPai.id,
          nature: 'DEBIT',
          is_synthetic: false
        });
        console.log(`   ✅ Criada: ${conta.code} - ${conta.name}`);
      }
    }
  } else {
    console.log('\n✅ Todas as contas necessárias existem');
  }

  console.log('\n' + '='.repeat(80));
}

verificar().catch(console.error);
