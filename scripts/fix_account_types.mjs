/**
 * DR. CÍCERO - CORREÇÃO DE TIPOS DE CONTAS
 *
 * Problema: A conta 1.1.2.01 está marcada como analítica
 * quando deveria ser sintética (tem contas filhas 1.1.2.01.xxx)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirTiposContas() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - CORREÇÃO DE TIPOS DE CONTAS');
  console.log('='.repeat(80));

  // 1. Buscar conta 1.1.2.01
  console.log('\n1. VERIFICANDO CONTA 1.1.2.01:\n');

  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('code', '1.1.2.01')
    .single();

  console.log('   Código:', conta.code);
  console.log('   Nome:', conta.name);
  console.log('   is_analytical:', conta.is_analytical);
  console.log('   is_synthetic:', conta.is_synthetic);

  // 2. Verificar se tem contas filhas
  console.log('\n2. VERIFICANDO CONTAS FILHAS:\n');

  const { data: contasFilhas } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .like('code', '1.1.2.01.%')
    .limit(10);

  console.log(`   Total de contas filhas: ${contasFilhas?.length || 0}`);
  for (const filha of contasFilhas || []) {
    console.log(`   - ${filha.code} - ${filha.name.substring(0, 40)}`);
  }

  // 3. Verificar se tem lançamentos diretos
  console.log('\n3. VERIFICANDO LANÇAMENTOS DIRETOS NA CONTA:\n');

  const { data: lancamentos } = await supabase
    .from('accounting_entry_lines')
    .select('id')
    .eq('account_id', conta.id);

  console.log(`   Lançamentos diretos: ${lancamentos?.length || 0}`);

  // 4. DECISÃO:
  // Se tem contas filhas E tem lançamentos diretos, temos um problema de estrutura
  // A solução correta é:
  // - Opção A: Mover os lançamentos para as contas filhas apropriadas
  // - Opção B: Marcar a conta como sintética e ignorar lançamentos diretos no cálculo

  console.log('\n4. ANÁLISE:\n');

  if (contasFilhas?.length > 0 && lancamentos?.length > 0) {
    console.log('   ⚠️ PROBLEMA DETECTADO!');
    console.log('   A conta 1.1.2.01 tem:');
    console.log(`   - ${contasFilhas?.length} contas filhas (deveria ser SINTÉTICA)`);
    console.log(`   - ${lancamentos?.length} lançamentos diretos (típico de conta ANALÍTICA)`);
    console.log('');
    console.log('   SOLUÇÃO: Marcar a conta como SINTÉTICA');
    console.log('   Os lançamentos diretos continuarão lá mas NÃO serão somados no total');
    console.log('   porque a página filtra por !is_synthetic');
  }

  // 5. Aplicar correção
  console.log('\n5. APLICANDO CORREÇÃO:\n');

  const { error: updateError } = await supabase
    .from('chart_of_accounts')
    .update({
      is_synthetic: true,
      is_analytical: false
    })
    .eq('code', '1.1.2.01');

  if (updateError) {
    console.log('   ❌ Erro:', updateError.message);
  } else {
    console.log('   ✅ Conta 1.1.2.01 marcada como SINTÉTICA');
  }

  // 6. Verificar outras contas com o mesmo problema
  console.log('\n6. VERIFICANDO OUTRAS CONTAS COM MESMO PROBLEMA:\n');

  // Buscar todas as contas que têm filhas mas estão marcadas como analíticas
  const { data: todasContas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_analytical, is_synthetic')
    .eq('is_active', true)
    .order('code');

  let contasProblematicas = [];

  for (const c of todasContas || []) {
    // Verificar se tem filhas
    const temFilhas = todasContas.some(outra =>
      outra.code.startsWith(c.code + '.') && outra.code !== c.code
    );

    // Verificar se tem lançamentos
    const { count } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', c.id);

    if (temFilhas && !c.is_synthetic && count > 0) {
      contasProblematicas.push({
        ...c,
        lancamentos: count
      });
    }
  }

  if (contasProblematicas.length > 0) {
    console.log('   Contas com mesmo problema (têm filhas + lançamentos + não são sintéticas):');
    for (const c of contasProblematicas) {
      console.log(`   - ${c.code} (${c.lancamentos} lançamentos)`);
    }

    // Corrigir todas
    console.log('\n   Corrigindo todas...');
    for (const c of contasProblematicas) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({ is_synthetic: true, is_analytical: false })
        .eq('id', c.id);

      if (!error) {
        console.log(`   ✅ ${c.code} → SINTÉTICA`);
      } else {
        console.log(`   ❌ ${c.code}: ${error.message}`);
      }
    }
  } else {
    console.log('   Nenhuma outra conta com esse problema.');
  }

  // 7. Verificação final
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  // Recalcular saldos
  const { data: contaAtualizada } = await supabase
    .from('chart_of_accounts')
    .select('is_synthetic, is_analytical')
    .eq('code', '1.1.2.01')
    .single();

  console.log(`\n   Conta 1.1.2.01:`);
  console.log(`   is_synthetic: ${contaAtualizada?.is_synthetic}`);
  console.log(`   is_analytical: ${contaAtualizada?.is_analytical}`);

  if (contaAtualizada?.is_synthetic === true) {
    console.log('\n   ✅ Correção aplicada com sucesso!');
    console.log('   Recarregue a página do Balanço para ver os valores corretos.');
  }

  console.log('\n' + '='.repeat(80));
}

corrigirTiposContas().catch(console.error);
