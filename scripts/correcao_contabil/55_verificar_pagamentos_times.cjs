// scripts/correcao_contabil/55_verificar_pagamentos_times.cjs
// Verificar se os pagamentos de TIMES estão registrados corretamente

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO PAGAMENTOS DE TIMES NEGOCIOS IMOBILIARIOS');
  console.log('='.repeat(100));

  // 1. Buscar dados de client_opening_balance
  const { data: honorarios } = await supabase
    .from('client_opening_balance')
    .select('*, clients(name)')
    .ilike('clients.name', '%TIMES%')
    .order('competence');

  console.log(`\n📋 Honorários em client_opening_balance (TIMES): ${honorarios?.length || 0}`);

  let totalHonorarios = 0;
  let totalPago = 0;
  let totalPendente = 0;

  honorarios?.forEach(h => {
    const valor = Number(h.amount || 0);
    const pago = Number(h.paid_amount || 0);
    const pendente = valor - pago;

    totalHonorarios += valor;
    totalPago += pago;
    if (h.status !== 'paid') totalPendente += pendente;

    console.log(`   ${h.competence} | Valor: ${valor.toFixed(2)} | Pago: ${pago.toFixed(2)} | Status: ${h.status}`);
  });

  console.log(`\n   TOTAL: R$ ${totalHonorarios.toFixed(2)} | Pago: R$ ${totalPago.toFixed(2)} | Pendente: R$ ${totalPendente.toFixed(2)}`);

  // 2. Buscar conta contábil
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%TIMES%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .single();

  console.log(`\n📊 Conta contábil: ${conta?.code} - ${conta?.name}`);

  // 3. Buscar lançamentos
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, accounting_entries(entry_date, description)')
    .eq('account_id', conta?.id)
    .order('accounting_entries(entry_date)');

  console.log(`\n📋 Lançamentos em accounting_entry_items: ${items?.length || 0}`);

  let contaDebit = 0;
  let contaCredit = 0;

  items?.forEach(i => {
    const d = Number(i.debit || 0);
    const c = Number(i.credit || 0);
    contaDebit += d;
    contaCredit += c;

    if (d > 0) {
      console.log(`   D ${d.toFixed(2)} - ${i.accounting_entries?.entry_date} - ${i.accounting_entries?.description?.substring(0, 50)}`);
    }
    if (c > 0) {
      console.log(`   C ${c.toFixed(2)} - ${i.accounting_entries?.entry_date} - ${i.accounting_entries?.description?.substring(0, 50)}`);
    }
  });

  console.log(`\n   DÉBITOS: R$ ${contaDebit.toFixed(2)} | CRÉDITOS: R$ ${contaCredit.toFixed(2)} | SALDO: R$ ${(contaDebit - contaCredit).toFixed(2)}`);

  // 4. Análise
  console.log('\n' + '='.repeat(100));
  console.log('📌 ANÁLISE:');
  console.log('='.repeat(100));

  console.log(`   Saldo contábil TIMES: R$ ${(contaDebit - contaCredit).toFixed(2)}`);
  console.log(`   Pendente em client_opening_balance: R$ ${totalPendente.toFixed(2)}`);

  const diff = (contaDebit - contaCredit) - totalPendente;
  console.log(`   Diferença: R$ ${diff.toFixed(2)}`);

  if (Math.abs(diff) > 100) {
    console.log(`\n⚠️  DIAGNÓSTICO: Faltam créditos de pagamento na contabilidade!`);
    console.log(`   - Honorários pagos: R$ ${totalPago.toFixed(2)}`);
    console.log(`   - Créditos registrados: R$ ${contaCredit.toFixed(2)}`);
    console.log(`   - Falta registrar: R$ ${(totalPago - contaCredit).toFixed(2)}`);
  }
}

verificar().catch(console.error);
