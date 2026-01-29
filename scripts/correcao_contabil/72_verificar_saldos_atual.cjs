// scripts/correcao_contabil/72_verificar_saldos_atual.cjs
// Verificar saldos pendentes vs contábil

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO SALDOS: HONORÁRIOS PENDENTES vs CONTÁBIL');
  console.log('='.repeat(100));

  // Buscar honorários PENDENTES
  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('id, client_id, competence, amount, paid_amount, status, clients(name)')
    .neq('status', 'paid');

  console.log('\n📋 HONORÁRIOS PENDENTES:');
  console.log('-'.repeat(100));

  let totalPendente = 0;
  for (const h of pendentes || []) {
    const saldo = Number(h.amount || 0) - Number(h.paid_amount || 0);
    totalPendente += saldo;
    const nome = (h.clients?.name || 'DESCONHECIDO').substring(0, 40).padEnd(40);
    console.log(`   ${nome} | ${h.competence.padEnd(8)} | R$ ${saldo.toFixed(2).padStart(10)}`);
  }
  console.log('-'.repeat(100));
  console.log(`   TOTAL PENDENTE: R$ ${totalPendente.toFixed(2)}`);

  // Verificar saldo contábil
  console.log('\n📊 SALDO CONTÁBIL (1.1.2.01.*):');
  console.log('-'.repeat(100));

  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .order('code');

  let totalDebitos = 0;
  for (const conta of subcontas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const debitosItems = items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const creditosItems = items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    const debitosLines = lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
    const creditosLines = lines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;

    const saldoConta = (debitosItems + debitosLines) - (creditosItems + creditosLines);

    if (saldoConta !== 0) {
      const nome = (conta.name || '').substring(0, 35).padEnd(35);
      console.log(`   ${conta.code} | ${nome} | R$ ${saldoConta.toFixed(2).padStart(10)}`);
    }
    totalDebitos += saldoConta;
  }
  console.log('-'.repeat(100));
  console.log(`   SALDO CONTÁBIL: R$ ${totalDebitos.toFixed(2)}`);

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESUMO:');
  console.log('='.repeat(100));
  console.log(`   Saldo Pendente (client_opening_balance): R$ ${totalPendente.toFixed(2)}`);
  console.log(`   Saldo Contábil (1.1.2.01.*): R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   DIFERENÇA: R$ ${(totalPendente - totalDebitos).toFixed(2)}`);

  if (Math.abs(totalPendente - totalDebitos) < 1) {
    console.log('\n✅ SALDOS CONFEREM!');
  } else {
    console.log('\n⚠️  DIFERENÇA ENCONTRADA - verificar lançamentos faltantes');
  }
  console.log('='.repeat(100));
}

verificar().catch(console.error);
