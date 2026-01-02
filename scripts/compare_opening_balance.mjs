/**
 * DR. CÍCERO - COMPARAR SALDO DE ABERTURA
 *
 * Página de Saldo de Abertura: R$ 192.995,01 pendente
 * Plano de Contas (2.3.03.02): R$ 298.527,29
 *
 * Diferença: R$ 105.532,28
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comparar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - COMPARAR SALDO DE ABERTURA');
  console.log('='.repeat(80));

  // 1. Buscar dados da tabela client_opening_balances
  console.log('\n1. TABELA client_opening_balances:\n');

  const { data: openingBalances, error: err1 } = await supabase
    .from('client_opening_balances')
    .select('*, client:clients(name)')
    .order('amount', { ascending: false });

  if (err1) {
    console.log('   Erro:', err1.message);
  } else {
    let totalPendente = 0;
    let totalPago = 0;
    let count = 0;

    for (const ob of openingBalances || []) {
      const valor = parseFloat(ob.amount || 0);
      const pago = parseFloat(ob.paid_amount || 0);
      const pendente = valor - pago;

      if (pendente > 0) {
        totalPendente += pendente;
        count++;
      }
      totalPago += pago;
    }

    console.log(`   Total registros: ${openingBalances?.length || 0}`);
    console.log(`   Total Pendente:  R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Total Pago:      R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Total Original:  R$ ${(totalPendente + totalPago).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  // 2. Buscar saldo no Plano de Contas
  console.log('\n2. PLANO DE CONTAS:\n');

  // Conta 1.1.2.01 - Clientes a Receber
  const { data: conta1121 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: linhas1121 } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta1121?.id);

  let d1121 = 0, c1121 = 0;
  for (const l of linhas1121 || []) {
    d1121 += parseFloat(l.debit || 0);
    c1121 += parseFloat(l.credit || 0);
  }

  console.log(`   1.1.2.01 (Clientes a Receber):`);
  console.log(`   - Débitos:  R$ ${d1121.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   - Créditos: R$ ${c1121.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   - Saldo:    R$ ${(d1121 - c1121).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // Conta 2.3.03.02 - Saldo de Abertura Clientes
  const { data: conta2302 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '2.3.03.02')
    .single();

  const { data: linhas2302 } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta2302?.id);

  let d2302 = 0, c2302 = 0;
  for (const l of linhas2302 || []) {
    d2302 += parseFloat(l.debit || 0);
    c2302 += parseFloat(l.credit || 0);
  }

  console.log(`\n   2.3.03.02 (Saldo de Abertura - Clientes):`);
  console.log(`   - Débitos:  R$ ${d2302.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   - Créditos: R$ ${c2302.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   - Saldo:    R$ ${(c2302 - d2302).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 3. Analisar
  console.log('\n3. ANÁLISE:\n');

  const saldoPaginaOpeningBalance = 192995.01;
  const saldoPlanoContas = c2302 - d2302;

  console.log(`   Página Saldo de Abertura: R$ ${saldoPaginaOpeningBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Plano de Contas:          R$ ${saldoPlanoContas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Diferença:                R$ ${(saldoPlanoContas - saldoPaginaOpeningBalance).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  console.log(`
  PARECER DR. CÍCERO:

  A página de Saldo de Abertura mostra R$ 192.995,01 pendente.
  O Plano de Contas mostra R$ ${saldoPlanoContas.toLocaleString('pt-BR', {minimumFractionDigits: 2})} como saldo inicial.

  POSSÍVEIS CAUSAS DA DIFERENÇA:

  1. A página mostra apenas competências ATÉ 31/12/2024 que ainda estão pendentes
  2. O Plano de Contas inclui TODOS os valores de clientes a receber iniciais
  3. Alguns valores já foram pagos (R$ 11.115,61 segundo a página)

  VERIFICAÇÃO:
  - Se somamos pendente + pago da página: R$ 192.995,01 + R$ 11.115,61 = R$ 204.110,62
  - Plano de Contas: R$ ${saldoPlanoContas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  - Ainda há diferença de R$ ${(saldoPlanoContas - 204110.62).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  `);

  // 4. Buscar detalhes dos lançamentos de saldo de abertura
  console.log('\n4. LANÇAMENTOS DE SALDO DE ABERTURA EM 1.1.2.01:\n');

  const { data: lancamentosAbertura } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit, description,
      entry:accounting_entries(entry_date, description, reference_type)
    `)
    .eq('account_id', conta1121?.id)
    .or('description.ilike.%saldo%,description.ilike.%abertura%,entry.reference_type.eq.opening_balance');

  let totalAberturaD = 0;
  for (const l of lancamentosAbertura || []) {
    const d = parseFloat(l.debit || 0);
    if (d > 0) {
      totalAberturaD += d;
      console.log(`   ${l.entry?.entry_date} | D: ${d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${(l.description || l.entry?.description || '').substring(0, 50)}`);
    }
  }
  console.log(`\n   Total Saldos de Abertura (Débitos): R$ ${totalAberturaD.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  console.log('\n' + '='.repeat(80));
}

comparar().catch(console.error);
