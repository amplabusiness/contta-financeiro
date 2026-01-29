/**
 * CRIAR CONTAS ANALÍTICAS PARA TARIFAS BANCÁRIAS DO SICREDI
 *
 * Estrutura:
 * 4.1.3.02 - Tarifas Bancárias (existente - será convertida em sintética)
 * 4.1.3.02.01 - Manutenção de Títulos (títulos > 3 meses sem quitar)
 * 4.1.3.02.02 - Tarifa Liquidação Cobrança (gerar boleto)
 * 4.1.3.02.03 - Cesta de Relacionamento (tarifa mensal)
 * 4.1.3.02.04 - Liquidação Cobrança Simples
 * 4.1.3.02.99 - Outras Tarifas Bancárias
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] || 'simulacao';

const CONTAS_TARIFAS = [
  { code: '4.1.3.02.01', name: 'Manutenção de Títulos', desc: 'Títulos com mais de 3 meses sem quitar' },
  { code: '4.1.3.02.02', name: 'Tarifa Liquidação Cobrança', desc: 'Taxa para gerar boleto' },
  { code: '4.1.3.02.03', name: 'Cesta de Relacionamento', desc: 'Tarifa mensal do banco' },
  { code: '4.1.3.02.04', name: 'Liquidação Cobrança Simples', desc: 'Taxa de cobrança simples' },
  { code: '4.1.3.02.99', name: 'Outras Tarifas Bancárias', desc: 'Outras tarifas não categorizadas' },
];

async function main() {
  console.log('═'.repeat(80));
  console.log('CRIAR CONTAS ANALÍTICAS PARA TARIFAS BANCÁRIAS');
  console.log(`Modo: ${MODO.toUpperCase()}`);
  console.log('═'.repeat(80));

  // 1. Verificar conta pai (4.1.3.02)
  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_synthetic, level')
    .eq('code', '4.1.3.02')
    .single();

  if (!contaPai) {
    console.log('❌ Conta 4.1.3.02 (Tarifas Bancárias) não encontrada');
    return;
  }

  console.log(`\n📌 Conta pai: ${contaPai.code} - ${contaPai.name}`);
  console.log(`   Sintética: ${contaPai.is_synthetic ? 'Sim' : 'Não'}`);

  // 2. Converter conta pai em sintética se necessário
  if (!contaPai.is_synthetic && MODO === 'aplicar') {
    console.log('\n⚙️  Convertendo conta pai em sintética...');
    const { error } = await supabase
      .from('chart_of_accounts')
      .update({ is_synthetic: true, account_type: 'synthetic' })
      .eq('id', contaPai.id);

    if (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    } else {
      console.log('   ✅ Conta convertida em sintética');
    }
  }

  // 3. Criar contas analíticas
  console.log('\n📋 Contas a criar:');

  for (const conta of CONTAS_TARIFAS) {
    // Verificar se já existe
    const { data: existente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', conta.code)
      .maybeSingle();

    if (existente) {
      console.log(`   ⏭️  ${conta.code} já existe: ${existente.name}`);
      continue;
    }

    console.log(`   ${conta.code} - ${conta.name}`);
    console.log(`      ${conta.desc}`);

    if (MODO === 'aplicar') {
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert({
          code: conta.code,
          name: conta.name,
          account_type: 'expense',
          is_synthetic: false,
          is_analytical: true,
          accepts_entries: true,
          level: 5,
          parent_id: contaPai.id,
          nature: 'debit',
          description: conta.desc
        });

      if (error) {
        console.log(`      ❌ Erro: ${error.message}`);
      } else {
        console.log(`      ✅ Criada`);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  if (MODO === 'simulacao') {
    console.log('💡 Para aplicar, execute:');
    console.log('   node scripts/criar_contas_tarifas_sicredi.mjs aplicar');
  }
  console.log('═'.repeat(80));
}

main().catch(console.error);
