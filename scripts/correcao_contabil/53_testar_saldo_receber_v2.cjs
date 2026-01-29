// scripts/correcao_contabil/53_testar_saldo_receber_v2.cjs
// Testar o cálculo de saldo de Clientes a Receber - versão otimizada

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testar() {
  console.log('='.repeat(100));
  console.log('TESTANDO CÁLCULO DE SALDO - CLIENTES A RECEBER (1.1.2.01)');
  console.log('='.repeat(100));

  // 1. Buscar todas as subcontas com lançamentos
  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01%')
    .order('code');

  console.log(`\n📋 Contas 1.1.2.01.* encontradas: ${subcontas?.length || 0}`);

  // 2. Para cada subconta, buscar saldo
  let totalDebitItems = 0;
  let totalCreditItems = 0;
  let totalDebitLines = 0;
  let totalCreditLines = 0;
  let contasComSaldo = 0;

  for (const conta of subcontas || []) {
    // Buscar em accounting_entry_items
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    // Buscar em accounting_entry_lines
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const dItems = items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const cItems = items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    const dLines = lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
    const cLines = lines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;

    const saldo = (dItems + dLines) - (cItems + cLines);

    if (saldo !== 0 || items?.length || lines?.length) {
      contasComSaldo++;
      console.log(`   ${conta.code} - ${conta.name.substring(0, 40)}: R$ ${saldo.toFixed(2)} (items: ${items?.length || 0}, lines: ${lines?.length || 0})`);
    }

    totalDebitItems += dItems;
    totalCreditItems += cItems;
    totalDebitLines += dLines;
    totalCreditLines += cLines;
  }

  // 3. Total combinado
  const totalDebit = totalDebitItems + totalDebitLines;
  const totalCredit = totalCreditItems + totalCreditLines;
  const saldoTotal = totalDebit - totalCredit;

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESUMO:');
  console.log('='.repeat(100));
  console.log(`   Contas com saldo: ${contasComSaldo}`);
  console.log(`   \n   accounting_entry_items: D=${totalDebitItems.toFixed(2)} | C=${totalCreditItems.toFixed(2)}`);
  console.log(`   accounting_entry_lines:  D=${totalDebitLines.toFixed(2)} | C=${totalCreditLines.toFixed(2)}`);
  console.log(`   \n   DÉBITOS TOTAIS: R$ ${totalDebit.toFixed(2)}`);
  console.log(`   CRÉDITOS TOTAIS: R$ ${totalCredit.toFixed(2)}`);
  console.log(`   \n   🎯 SALDO FINAL CLIENTES A RECEBER: R$ ${saldoTotal.toFixed(2)}`);
  console.log('='.repeat(100));

  // 4. Comparar com client_opening_balance
  console.log('\n📊 VALIDAÇÃO - client_opening_balance:');

  const { data: honorarios } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount, status');

  const totalPendente = honorarios?.reduce((s, h) => {
    if (h.status === 'paid') return s;
    const restante = Number(h.amount || 0) - Number(h.paid_amount || 0);
    return s + (restante > 0 ? restante : 0);
  }, 0) || 0;

  console.log(`   Total pendente em client_opening_balance: R$ ${totalPendente.toFixed(2)}`);

  const diferenca = saldoTotal - totalPendente;
  console.log(`   Diferença: R$ ${diferenca.toFixed(2)}`);

  if (Math.abs(diferenca) < 1) {
    console.log(`\n✅ SALDOS CONFEREM!`);
  } else {
    console.log(`\n⚠️  Há diferença - pode haver honorários com pagamento parcial registrado na contabilidade`);
  }
}

testar().catch(console.error);
