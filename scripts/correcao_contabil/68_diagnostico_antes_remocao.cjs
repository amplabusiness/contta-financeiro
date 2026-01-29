// scripts/correcao_contabil/68_diagnostico_antes_remocao.cjs
// Diagnóstico antes de remover lançamentos de honorários pagos

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnostico() {
  console.log('='.repeat(100));
  console.log('DIAGNÓSTICO ANTES DA REMOÇÃO');
  console.log('='.repeat(100));

  // 1. Resumo de client_opening_balance
  const { data: todos } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount, status');

  const totalHonorarios = todos?.length || 0;
  const pagos = todos?.filter(h => h.status === 'paid') || [];
  const pendentes = todos?.filter(h => h.status !== 'paid') || [];

  const valorTotalPagos = pagos.reduce((s, h) => s + Number(h.amount || 0), 0);
  const valorTotalPendentes = pendentes.reduce((s, h) => s + Number(h.amount || 0) - Number(h.paid_amount || 0), 0);

  console.log('\n📊 CLIENT_OPENING_BALANCE:');
  console.log(`   Total de honorários: ${totalHonorarios}`);
  console.log(`   PAGOS: ${pagos.length} (R$ ${valorTotalPagos.toFixed(2)})`);
  console.log(`   PENDENTES: ${pendentes.length} (R$ ${valorTotalPendentes.toFixed(2)})`);

  // 2. Saldo contábil atual
  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  let totalDebitos = 0;
  let totalCreditos = 0;

  for (const conta of subcontas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    totalDebitos += (items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0);
    totalDebitos += (lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0);
    totalCreditos += (items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0);
    totalCreditos += (lines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0);
  }

  const saldoContabil = totalDebitos - totalCreditos;

  console.log('\n📊 SALDO CONTÁBIL ATUAL (1.1.2.01.*):');
  console.log(`   Débitos: R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Créditos: R$ ${totalCreditos.toFixed(2)}`);
  console.log(`   Saldo: R$ ${saldoContabil.toFixed(2)}`);

  // 3. O que deveria ser
  console.log('\n📊 O QUE DEVERIA SER:');
  console.log(`   Saldo Clientes a Receber = R$ ${valorTotalPendentes.toFixed(2)} (apenas pendentes)`);

  // 4. Diferença (lançamentos a remover)
  const diferenca = saldoContabil - valorTotalPendentes;
  console.log('\n📊 DIFERENÇA (lançamentos de PAGOS a remover):');
  console.log(`   R$ ${diferenca.toFixed(2)}`);

  // 5. Lançamentos de saldo de abertura
  const { data: entries, count } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact' })
    .or('entry_type.eq.SALDO_ABERTURA,description.ilike.%Saldo de abertura%');

  console.log(`\n📊 LANÇAMENTOS DE SALDO DE ABERTURA:`);
  console.log(`   Total: ${count}`);

  console.log('\n' + '='.repeat(100));
  console.log('📌 AÇÃO RECOMENDADA:');
  console.log('='.repeat(100));
  console.log(`   Remover R$ ${diferenca.toFixed(2)} em lançamentos de honorários PAGOS`);
  console.log(`   Isso fará o saldo contábil bater com o saldo pendente: R$ ${valorTotalPendentes.toFixed(2)}`);
  console.log('='.repeat(100));
}

diagnostico().catch(console.error);
