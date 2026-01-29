/**
 * DR. CÍCERO - CORRIGIR DESPESAS PARA CONTAS ANALÍTICAS
 *
 * Reclassifica lançamentos que estão na conta sintética 4.1.2.01
 * para as contas analíticas corretas (4.1.2.01.XX) baseado no nome do colaborador.
 *
 * NBC TG 26: Lançamentos devem ser em contas ANALÍTICAS
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Colaboradores → 4.1.1.01 (Salários e Ordenados - conta analítica que aceita lançamentos)
const COLABORADORES = [
  'DANIEL RODRIGUES RIBEIRO',
  'JOSIMAR DOS SANTOS MOTA',
  'ROSEMEIRE RODRIGUES',
  'ANDREA LEONE BASTOS',
  'ALEXSSANDRA FERREIRA RAMOS',
  'FABRICIO SOARES BOMFIM',
  'CORACI ALINE DOS SANTOS',
  'ANDREA FERREIRA FAGUNDES',
  'THAYNARA',
  'TAYLANE BELLE',
  'LILIAN MOREIRA',
  'FABIANA MARIA',
  'DEUZA RESENDE'
];
const CONTA_SALARIOS = '4.1.1.01'; // Salários e Ordenados

const MODO = process.argv[2] || 'simulacao';

function identificarColaborador(descricao) {
  const descUpper = descricao.toUpperCase();

  for (const colab of COLABORADORES) {
    if (descUpper.includes(colab.toUpperCase())) {
      return { colaborador: colab, conta: CONTA_SALARIOS };
    }
  }

  return null;
}

async function main() {
  console.log('═'.repeat(100));
  console.log('🤖 DR. CÍCERO - CORREÇÃO DE DESPESAS PARA CONTAS ANALÍTICAS');
  console.log(`   Modo: ${MODO.toUpperCase()}`);
  console.log('═'.repeat(100));

  // 1. Buscar conta sintética 4.1.2.01
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '4.1.2.01')
    .single();

  if (!contaSintetica) {
    console.log('❌ Conta 4.1.2.01 não encontrada');
    return;
  }

  console.log(`\n📌 Conta Sintética: ${contaSintetica.code} - ${contaSintetica.name}`);

  // 2. Buscar todos os items nessa conta (débitos)
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, entry_id, account_id')
    .eq('account_id', contaSintetica.id)
    .gt('debit', 0);

  console.log(`\n📊 Items na conta sintética: ${items?.length || 0}`);

  if (!items || items.length === 0) {
    console.log('✅ Nenhum item na conta sintética. Já está correto!');
    return;
  }

  // 3. Buscar os entries correspondentes
  const entryIds = [...new Set(items.map(i => i.entry_id))];
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, description')
    .in('id', entryIds);

  // Criar mapa entry_id -> description
  const entryDescricao = {};
  for (const e of entries || []) {
    entryDescricao[e.id] = e.description;
  }

  // 4. Processar cada item
  let corrigidos = 0;
  let naoIdentificados = 0;

  for (const item of items) {
    const descricao = entryDescricao[item.entry_id] || '';
    const resultado = identificarColaborador(descricao);

    if (!resultado) {
      naoIdentificados++;
      continue;
    }

    // Buscar conta analítica de destino
    const { data: contaAnalitica } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', resultado.conta)
      .maybeSingle();

    if (!contaAnalitica) {
      console.log(`   ⚠️  Conta ${resultado.conta} não encontrada para ${resultado.colaborador}`);
      continue;
    }

    console.log(`\n[${resultado.colaborador}]`);
    console.log(`   ${descricao.substring(0, 60)}`);
    console.log(`   ${contaSintetica.code} → ${contaAnalitica.code}`);

    if (MODO === 'aplicar') {
      const { error } = await supabase
        .from('accounting_entry_items')
        .update({ account_id: contaAnalitica.id })
        .eq('id', item.id);

      if (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      } else {
        console.log(`   ✅ Corrigido`);
        corrigidos++;
      }
    } else {
      corrigidos++;
    }
  }

  console.log('\n' + '═'.repeat(100));
  console.log('📊 RESUMO');
  console.log('═'.repeat(100));
  console.log(`Total de items: ${items.length}`);
  console.log(`Corrigidos: ${corrigidos}`);
  console.log(`Não identificados: ${naoIdentificados}`);

  if (MODO === 'simulacao') {
    console.log('\n💡 Para aplicar as correções, execute:');
    console.log('   node scripts/dr_cicero_corrigir_despesas_analiticas.mjs aplicar');
  }

  console.log('═'.repeat(100));
}

main().catch(console.error);
