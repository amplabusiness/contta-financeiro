// scripts/correcao_contabil/61_teste_rapido_saldo.cjs
// Teste rápido do saldo de Clientes a Receber para janeiro/2025

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testar() {
  console.log('='.repeat(100));
  console.log('TESTE RÁPIDO - SALDO CLIENTES A RECEBER PARA JANEIRO/2025');
  console.log('='.repeat(100));

  // 1. Buscar subcontas de clientes (sem CONSOLIDADO)
  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  const accountIds = subcontas?.map(s => s.id) || [];
  console.log(`\n📋 Subcontas de clientes: ${accountIds.length}`);

  // 2. Buscar TODOS os lançamentos dessas contas (de ambas as tabelas)
  // para calcular o saldo

  // De accounting_entry_items
  const { data: allItems } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, accounting_entries!inner(entry_date)')
    .in('account_id', accountIds);

  // De accounting_entry_lines
  const { data: allLines } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, accounting_entries!inner(entry_date)')
    .in('account_id', accountIds);

  // Separar por período: antes de 01/01/2025 e durante janeiro/2025
  const DATA_INICIO = '2025-01-01';
  const DATA_FIM = '2025-01-31';

  let saldoInicial_D = 0, saldoInicial_C = 0;
  let periodo_D = 0, periodo_C = 0;

  // Processar items
  allItems?.forEach(item => {
    const data = item.accounting_entries?.entry_date;
    if (data < DATA_INICIO) {
      saldoInicial_D += Number(item.debit || 0);
      saldoInicial_C += Number(item.credit || 0);
    } else if (data >= DATA_INICIO && data <= DATA_FIM) {
      periodo_D += Number(item.debit || 0);
      periodo_C += Number(item.credit || 0);
    }
  });

  // Processar lines
  allLines?.forEach(line => {
    const data = line.accounting_entries?.entry_date;
    if (data < DATA_INICIO) {
      saldoInicial_D += Number(line.debit || 0);
      saldoInicial_C += Number(line.credit || 0);
    } else if (data >= DATA_INICIO && data <= DATA_FIM) {
      periodo_D += Number(line.debit || 0);
      periodo_C += Number(line.credit || 0);
    }
  });

  const saldoInicial = saldoInicial_D - saldoInicial_C;
  const saldoFinal = saldoInicial + periodo_D - periodo_C;

  console.log('\n📊 RESULTADO PARA JANEIRO/2025:');
  console.log('='.repeat(50));
  console.log(`   SALDO INICIAL (até 31/12/2024):`);
  console.log(`      Débitos: R$ ${saldoInicial_D.toFixed(2)}`);
  console.log(`      Créditos: R$ ${saldoInicial_C.toFixed(2)}`);
  console.log(`      Saldo: R$ ${saldoInicial.toFixed(2)}`);
  console.log(`\n   MOVIMENTOS EM JANEIRO/2025:`);
  console.log(`      Débitos: R$ ${periodo_D.toFixed(2)}`);
  console.log(`      Créditos: R$ ${periodo_C.toFixed(2)}`);
  console.log(`\n   🎯 SALDO FINAL: R$ ${saldoFinal.toFixed(2)}`);
  console.log('='.repeat(50));

  // 3. Comparar com client_opening_balance
  console.log('\n📊 VALIDAÇÃO - client_opening_balance:');
  const { data: honorarios } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount, status');

  const totalPendente = honorarios?.reduce((s, h) => {
    if (h.status === 'paid') return s;
    return s + (Number(h.amount || 0) - Number(h.paid_amount || 0));
  }, 0) || 0;

  console.log(`   Total pendente: R$ ${totalPendente.toFixed(2)}`);

  const diff = saldoFinal - totalPendente;
  console.log(`   Diferença: R$ ${diff.toFixed(2)}`);

  if (Math.abs(diff) < 100) {
    console.log('\n✅ SALDOS CONFEREM!');
  }
}

testar().catch(console.error);
