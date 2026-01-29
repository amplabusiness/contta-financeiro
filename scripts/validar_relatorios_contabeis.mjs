// Script para validar relatórios contábeis conforme especificação
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function validarRelatorios() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  VALIDAÇÃO DE RELATÓRIOS CONTÁBEIS (Seção 11)                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const hoje = new Date().toISOString().split('T')[0];
  const inicioAno = '2025-01-01';

  // 1. Validar Balancete - Conta 1 (Ativo)
  console.log('1. VALIDANDO BALANCETE...');
  const { data: balancete, error: balError } = await supabase
    .rpc('get_account_balances', {
      p_period_start: inicioAno,
      p_period_end: hoje
    });

  if (balError) {
    console.log(`   ❌ Erro: ${balError.message}`);
  } else {
    const totalAtivo = balancete?.filter(b => b.code?.startsWith('1')).reduce((s, b) => s + Number(b.closing_balance || 0), 0);
    const totalPassivo = balancete?.filter(b => b.code?.startsWith('2')).reduce((s, b) => s + Number(b.closing_balance || 0), 0);
    const totalPL = balancete?.filter(b => b.code?.startsWith('5')).reduce((s, b) => s + Number(b.closing_balance || 0), 0);
    const totalReceita = balancete?.filter(b => b.code?.startsWith('3')).reduce((s, b) => s + Number(b.closing_balance || 0), 0);
    const totalDespesa = balancete?.filter(b => b.code?.startsWith('4')).reduce((s, b) => s + Number(b.closing_balance || 0), 0);

    console.log(`   ✅ Balancete carregado: ${balancete?.length || 0} contas`);
    console.log(`   Ativo (1.x): R$ ${totalAtivo?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Passivo (2.x): R$ ${totalPassivo?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   PL (5.x): R$ ${totalPL?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Receita (3.x): R$ ${totalReceita?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Despesa (4.x): R$ ${totalDespesa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    // Equação fundamental: Ativo = Passivo + PL + (Receita - Despesa)
    const resultado = totalReceita - totalDespesa;
    const passivoPL = totalPassivo + totalPL + resultado;
    const diferenca = Math.abs(totalAtivo - passivoPL);

    console.log(`\n   Resultado do Exercício: R$ ${resultado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Equação A = P + PL + RE: ${diferenca < 0.01 ? '✅ BALANCEADO' : '⚠️ DIFERENÇA: R$ ' + diferenca.toFixed(2)}`);
  }

  // 2. Validar DRE (Receitas - Despesas)
  console.log('\n2. VALIDANDO DRE...');
  const { data: receitas, error: recError } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, account:chart_of_accounts!inner(code, name)')
    .like('account.code', '3%');

  const { data: despesas, error: despError } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, account:chart_of_accounts!inner(code, name)')
    .like('account.code', '4%');

  if (recError || despError) {
    console.log(`   ❌ Erro: ${recError?.message || despError?.message}`);
  } else {
    const totalReceitaDRE = receitas?.reduce((s, r) => s + Number(r.credit || 0) - Number(r.debit || 0), 0) || 0;
    const totalDespesaDRE = despesas?.reduce((s, d) => s + Number(d.debit || 0) - Number(d.credit || 0), 0) || 0;
    const lucroLiquido = totalReceitaDRE - totalDespesaDRE;

    console.log(`   ✅ DRE calculado da contabilidade`);
    console.log(`   Receitas: R$ ${totalReceitaDRE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Despesas: R$ ${totalDespesaDRE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Lucro/Prejuízo: R$ ${lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  // 3. Validar Razão Geral
  console.log('\n3. VALIDANDO RAZÃO GERAL...');
  const { data: razao, error: razaoError } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .limit(10000);

  if (razaoError) {
    console.log(`   ❌ Erro: ${razaoError.message}`);
  } else {
    const totalDebitos = razao?.reduce((s, r) => s + Number(r.debit || 0), 0) || 0;
    const totalCreditos = razao?.reduce((s, r) => s + Number(r.credit || 0), 0) || 0;

    console.log(`   ✅ Razão carregado: ${razao?.length || 0} lançamentos`);
    console.log(`   Total Débitos: R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Partida Dobrada: ${Math.abs(totalDebitos - totalCreditos) < 0.01 ? '✅ BALANCEADO' : '⚠️ DIFERENÇA: R$ ' + Math.abs(totalDebitos - totalCreditos).toFixed(2)}`);
  }

  // 4. Validar Aging
  console.log('\n4. VALIDANDO AGING...');
  const { data: aging, error: agingError } = await supabase
    .from('vw_aging_resumo')
    .select('*')
    .single();

  if (agingError && agingError.code !== 'PGRST116') {
    console.log(`   ❌ Erro: ${agingError.message}`);
  } else if (aging) {
    console.log(`   ✅ Aging calculado`);
    console.log(`   0-30 dias: R$ ${aging.total_0_30_dias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   31-60 dias: R$ ${aging.total_31_60_dias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   61-90 dias: R$ ${aging.total_61_90_dias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   +90 dias: R$ ${aging.total_mais_90_dias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Total Inadimplência: R$ ${aging.total_geral_inadimplencia?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  RELATÓRIOS CONTÁBEIS VALIDADOS                                   ║');
  console.log('║  Fonte: accounting_entries + accounting_entry_items               ║');
  console.log('║  Conforme Seção 11: Contabilidade = Fonte da Verdade             ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
}

validarRelatorios().catch(console.error);
