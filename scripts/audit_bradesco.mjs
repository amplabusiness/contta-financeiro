/**
 * DR. CÍCERO - INVESTIGAÇÃO SALDO FANTASMA BANCO BRADESCO
 *
 * Valor reportado no Balanço: R$ 90.725,10
 * Conta: 1.1.1.02
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
  console.log('AUDITORIA DR. CÍCERO - INVESTIGAÇÃO BANCO BRADESCO');
  console.log('Valor Reportado no Balanço: R$ 90.725,10');
  console.log('='.repeat(80));

  // 1. Verificar conta no plano de contas
  console.log('\n1. CONTA NO PLANO DE CONTAS:\n');
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('code', '1.1.1.02')
    .single();

  if (!conta) {
    console.log('   ❌ CONTA 1.1.1.02 NÃO ENCONTRADA NO PLANO!');

    // Buscar todas as contas de banco
    const { data: contasBanco } = await supabase
      .from('chart_of_accounts')
      .select('code, name, is_active')
      .like('code', '1.1.1.%')
      .order('code');

    console.log('\n   Contas de banco existentes:');
    for (const c of contasBanco || []) {
      console.log(`   ${c.code} - ${c.name} (${c.is_active ? 'ativa' : 'inativa'})`);
    }
    return;
  }

  console.log('   Conta:', conta.code, '-', conta.name);
  console.log('   ID:', conta.id);
  console.log('   Ativa:', conta.is_active);
  console.log('   Natureza:', conta.nature);

  // 2. Buscar TODOS os lançamentos nessa conta
  console.log('\n2. LANÇAMENTOS NA CONTA 1.1.1.02:\n');
  const { data: linhas, error: linhasErr } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      debit,
      credit,
      description,
      entry_id
    `)
    .eq('account_id', conta.id);

  if (linhasErr) {
    console.log('   Erro:', linhasErr.message);
    return;
  }

  console.log('   Total de linhas:', linhas?.length || 0);

  if (!linhas || linhas.length === 0) {
    console.log('\n   ⚠️ NENHUM LANÇAMENTO ENCONTRADO NESTA CONTA!');
    console.log('   O saldo de R$ 90.725,10 NÃO deveria existir.');

    // Verificar se há saldo vindo de outra fonte
    console.log('\n3. INVESTIGANDO ORIGEM DO SALDO FANTASMA...\n');

    // Verificar bank_accounts
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('*')
      .ilike('name', '%bradesco%');

    console.log('   Contas bancárias com "Bradesco":');
    for (const ba of bankAccounts || []) {
      console.log(`   - ${ba.name}: Saldo R$ ${ba.current_balance?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    }

    // Verificar bank_opening_balances
    const { data: openingBalances } = await supabase
      .from('bank_opening_balances')
      .select('*, bank_account:bank_accounts(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    console.log('\n   Saldos de abertura bancários:');
    for (const ob of openingBalances || []) {
      console.log(`   - ${ob.bank_account?.name || 'N/A'} ${ob.month}/${ob.year}: R$ ${ob.opening_balance?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    }

    return;
  }

  let totalDebito = 0;
  let totalCredito = 0;

  // Buscar detalhes dos entries
  const entryIds = [...new Set(linhas.map(l => l.entry_id))];
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, reference_type, internal_code')
    .in('id', entryIds);

  const entriesMap = new Map(entries?.map(e => [e.id, e]) || []);

  console.log('\n   Detalhes dos lançamentos:');
  for (const linha of linhas) {
    const entry = entriesMap.get(linha.entry_id);
    totalDebito += parseFloat(linha.debit || 0);
    totalCredito += parseFloat(linha.credit || 0);

    const debit = parseFloat(linha.debit || 0);
    const credit = parseFloat(linha.credit || 0);

    console.log(`   ${entry?.entry_date || 'S/D'} | D: ${debit.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C: ${credit.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${(linha.description || entry?.description || '').substring(0, 40)}`);
  }

  console.log('\n   TOTAIS:');
  console.log('   Total Débitos:  R$', totalDebito.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('   Total Créditos: R$', totalCredito.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('   Saldo (D-C):    R$', (totalDebito - totalCredito).toLocaleString('pt-BR', {minimumFractionDigits: 2}));

  // 3. Comparar com valor do balanço
  console.log('\n3. ANÁLISE:\n');
  const saldoCalculado = totalDebito - totalCredito;
  const saldoReportado = 90725.10;

  if (Math.abs(saldoCalculado - saldoReportado) < 0.01) {
    console.log('   ✅ Saldo calculado confere com o reportado.');
  } else {
    console.log('   ❌ DIVERGÊNCIA DETECTADA!');
    console.log(`   Saldo Calculado: R$ ${saldoCalculado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Saldo Reportado: R$ ${saldoReportado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Diferença:       R$ ${(saldoReportado - saldoCalculado).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }
}

// Também investigar a página BalanceSheet.tsx
async function investigarPagina() {
  console.log('\n' + '='.repeat(80));
  console.log('4. INVESTIGANDO LÓGICA DA PÁGINA BALANCE-SHEET');
  console.log('='.repeat(80));

  // Buscar todas as contas do grupo 1.1.1 (Disponibilidades)
  const { data: contasBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_active')
    .like('code', '1.1.1.%')
    .eq('is_analytical', true)
    .order('code');

  console.log('\n   Contas analíticas do grupo 1.1.1 (Disponibilidades):');

  for (const conta of contasBanco || []) {
    // Buscar saldo de cada conta
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let totalD = 0, totalC = 0;
    for (const l of linhas || []) {
      totalD += parseFloat(l.debit || 0);
      totalC += parseFloat(l.credit || 0);
    }
    const saldo = totalD - totalC;

    const status = conta.is_active ? '✓' : '✗';
    console.log(`   ${status} ${conta.code} - ${conta.name.padEnd(30)} | Saldo: R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)} (${linhas?.length || 0} lançamentos)`);
  }
}

investigar()
  .then(() => investigarPagina())
  .catch(console.error);
