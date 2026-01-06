/**
 * DR. CÍCERO - INVESTIGAR DIFERENÇA NO BALANÇO
 *
 * Diferença encontrada: R$ 1.127,59
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - INVESTIGAR DIFERENÇA NO BALANÇO');
  console.log('Diferença: R$ 1.127,59');
  console.log('='.repeat(80));

  // A diferença pode estar em contas do grupo 1.1.2.01.xxx
  // que estão contadas duas vezes (na conta sintética E nas analíticas)

  console.log('\n1. INVESTIGANDO CONTA 1.1.2.01 (Clientes a Receber)\n');

  // Buscar a conta sintética
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_analytical, is_synthetic')
    .eq('code', '1.1.2.01')
    .single();

  console.log('   Conta sintética 1.1.2.01:');
  console.log('   ID:', contaSintetica?.id);
  console.log('   is_analytical:', contaSintetica?.is_analytical);
  console.log('   is_synthetic:', contaSintetica?.is_synthetic);

  // Buscar lançamentos na conta sintética
  const { data: linhasSintetica } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaSintetica?.id);

  let totalD = 0, totalC = 0;
  for (const l of linhasSintetica || []) {
    totalD += parseFloat(l.debit || 0);
    totalC += parseFloat(l.credit || 0);
  }

  console.log(`\n   Lançamentos na conta SINTÉTICA 1.1.2.01:`);
  console.log(`   Total linhas: ${linhasSintetica?.length || 0}`);
  console.log(`   Total Débitos: R$ ${totalD.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Total Créditos: R$ ${totalC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Saldo: R$ ${(totalD - totalC).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // Buscar contas analíticas filhas
  console.log('\n2. CONTAS ANALÍTICAS FILHAS (1.1.2.01.xxx):\n');

  const { data: contasFilhas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_analytical')
    .like('code', '1.1.2.01.%')
    .eq('is_analytical', true);

  console.log(`   Total de contas filhas: ${contasFilhas?.length || 0}`);

  let totalFilhas = 0;
  for (const conta of contasFilhas || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let d = 0, c = 0;
    for (const l of linhas || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }
    const saldo = d - c;
    if (saldo !== 0) {
      totalFilhas += saldo;
    }
  }

  console.log(`\n   Soma dos saldos das contas filhas: R$ ${totalFilhas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 3. Problema: Se a conta 1.1.2.01 é sintética mas tem lançamentos diretos,
  // esses lançamentos estão sendo somados DUAS VEZES no cálculo

  console.log('\n3. ANÁLISE:\n');

  if (linhasSintetica?.length > 0) {
    console.log('   ⚠️ PROBLEMA DETECTADO!');
    console.log('   A conta 1.1.2.01 é marcada como analítica MAS deveria ser sintética.');
    console.log('   Ela tem lançamentos diretos E contas filhas.');
    console.log('');
    console.log('   O balanço está somando:');
    console.log(`   - Saldo da conta 1.1.2.01:         R$ ${(totalD - totalC).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   - Soma das contas 1.1.2.01.xxx:   R$ ${totalFilhas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   - TOTAL (duplicado):               R$ ${((totalD - totalC) + totalFilhas).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  // 4. Verificar qual é a diferença exata
  console.log('\n4. COMPARAÇÃO COM A DIFERENÇA:\n');

  // A diferença é 1.127,59
  // Vamos ver se bate com algum valor específico

  // Listar as contas filhas com saldo
  console.log('   Contas filhas com saldo:');
  for (const conta of contasFilhas || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let d = 0, c = 0;
    for (const l of linhas || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }
    const saldo = d - c;
    if (saldo !== 0) {
      console.log(`   ${conta.code} - R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    }
  }

  // 5. Verificar contas de adiantamento
  console.log('\n5. VERIFICANDO CONTAS DE ADIANTAMENTO (1.1.3.x):\n');

  const { data: contasAdiantamento } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.3.%')
    .eq('is_analytical', true);

  let totalAdiantamentos = 0;
  for (const conta of contasAdiantamento || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let d = 0, c = 0;
    for (const l of linhas || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }
    const saldo = d - c;
    if (saldo !== 0) {
      totalAdiantamentos += saldo;
      console.log(`   ${conta.code.padEnd(15)} ${conta.name.substring(0, 30).padEnd(30)} R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    }
  }
  console.log(`\n   Total Adiantamentos: R$ ${totalAdiantamentos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 6. Verificar se há contas sendo contadas duas vezes no cálculo
  console.log('\n6. VERIFICANDO DUPLICIDADE DE LANÇAMENTOS:\n');

  // A diferença é exatamente R$ 1.127,59
  // Vamos procurar lançamentos com esse valor ou próximos

  const { data: lancamentosSuspeitos } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit, account_id, description,
      account:chart_of_accounts(code, name)
    `)
    .or('debit.gte.1120,credit.gte.1120')
    .or('debit.lte.1135,credit.lte.1135');

  // Filtrar para valores próximos de 1127.59
  const proximos = (lancamentosSuspeitos || []).filter(l => {
    const valor = parseFloat(l.debit || 0) || parseFloat(l.credit || 0);
    return Math.abs(valor - 1127.59) < 10;
  });

  if (proximos.length > 0) {
    console.log('   Lançamentos com valores próximos a R$ 1.127,59:');
    for (const l of proximos) {
      console.log(`   ${l.account?.code} D:${l.debit} C:${l.credit} - ${l.description?.substring(0, 40)}`);
    }
  } else {
    console.log('   Nenhum lançamento individual com esse valor.');
  }

  console.log('\n' + '='.repeat(80));
}

investigar().catch(console.error);
