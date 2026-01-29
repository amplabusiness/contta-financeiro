// scripts/correcao_contabil/52_testar_saldo_receber.cjs
// Testar o cálculo de saldo de Clientes a Receber após correção

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

  // 1. Buscar conta 1.1.2.01
  const { data: contaReceber } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, nature, is_analytical')
    .eq('code', '1.1.2.01')
    .single();

  console.log(`\n📊 Conta: ${contaReceber.code} - ${contaReceber.name}`);
  console.log(`   Natureza: ${contaReceber.nature}`);
  console.log(`   É analítica: ${contaReceber.is_analytical}`);

  // 2. Buscar todas as subcontas
  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%');

  console.log(`\n📋 Subcontas encontradas: ${subcontas?.length || 0}`);

  // Criar array com todos os IDs
  const allIds = [contaReceber.id, ...(subcontas || []).map(s => s.id)];

  // 3. Buscar lançamentos em accounting_entry_items
  const { data: items, count: itemsCount } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, account_id', { count: 'exact' })
    .in('account_id', allIds);

  const itemsDebit = items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
  const itemsCredit = items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;

  console.log(`\n📊 accounting_entry_items:`);
  console.log(`   Registros: ${itemsCount}`);
  console.log(`   Débitos: R$ ${itemsDebit.toFixed(2)}`);
  console.log(`   Créditos: R$ ${itemsCredit.toFixed(2)}`);
  console.log(`   Saldo (D-C): R$ ${(itemsDebit - itemsCredit).toFixed(2)}`);

  // 4. Buscar lançamentos em accounting_entry_lines
  const { data: lines, count: linesCount } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, account_id', { count: 'exact' })
    .in('account_id', allIds);

  const linesDebit = lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
  const linesCredit = lines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;

  console.log(`\n📊 accounting_entry_lines:`);
  console.log(`   Registros: ${linesCount}`);
  console.log(`   Débitos: R$ ${linesDebit.toFixed(2)}`);
  console.log(`   Créditos: R$ ${linesCredit.toFixed(2)}`);
  console.log(`   Saldo (D-C): R$ ${(linesDebit - linesCredit).toFixed(2)}`);

  // 5. Total combinado
  const totalDebit = itemsDebit + linesDebit;
  const totalCredit = itemsCredit + linesCredit;
  const saldoTotal = totalDebit - totalCredit;

  console.log('\n' + '='.repeat(100));
  console.log('📌 SALDO TOTAL COMBINADO (FONTE DA VERDADE):');
  console.log('='.repeat(100));
  console.log(`   Débitos totais: R$ ${totalDebit.toFixed(2)}`);
  console.log(`   Créditos totais: R$ ${totalCredit.toFixed(2)}`);
  console.log(`   SALDO FINAL: R$ ${saldoTotal.toFixed(2)}`);
  console.log('='.repeat(100));

  // 6. Comparar com client_opening_balance (para validação)
  console.log('\n📊 VALIDAÇÃO - client_opening_balance:');

  const { data: honorarios } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount, status');

  const totalHonorarios = honorarios?.reduce((s, h) => s + Number(h.amount || 0), 0) || 0;
  const totalPago = honorarios?.reduce((s, h) => s + Number(h.paid_amount || 0), 0) || 0;
  const totalPendente = honorarios?.reduce((s, h) => {
    const restante = Number(h.amount || 0) - Number(h.paid_amount || 0);
    return s + (h.status !== 'paid' && restante > 0 ? restante : 0);
  }, 0) || 0;

  console.log(`   Total honorários: R$ ${totalHonorarios.toFixed(2)}`);
  console.log(`   Total pago: R$ ${totalPago.toFixed(2)}`);
  console.log(`   Total pendente (status != paid): R$ ${totalPendente.toFixed(2)}`);

  // 7. Verificar diferença
  const diferenca = saldoTotal - totalPendente;
  if (Math.abs(diferenca) < 1) {
    console.log(`\n✅ VALIDAÇÃO OK - Diferença: R$ ${diferenca.toFixed(2)}`);
  } else {
    console.log(`\n⚠️  DIFERENÇA: R$ ${diferenca.toFixed(2)}`);
    console.log('   Pode haver lançamentos de pagamento não registrados em client_opening_balance');
  }
}

testar().catch(console.error);
