// scripts/correcao_contabil/69_remover_lancamentos_pagos_v2.cjs
// Remover lançamentos de honorários PAGOS - versão precisa

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function remover() {
  console.log('='.repeat(100));
  console.log('REMOVENDO LANÇAMENTOS DE HONORÁRIOS PAGOS');
  console.log('='.repeat(100));

  // 1. Buscar honorários PAGOS com dados do cliente
  const { data: pagos } = await supabase
    .from('client_opening_balance')
    .select('id, client_id, competence, amount, status, clients(name)')
    .eq('status', 'paid');

  console.log(`\n📋 Honorários PAGOS: ${pagos?.length || 0}`);

  let totalRemovido = 0;
  let lancamentosRemovidos = 0;

  for (const hon of pagos || []) {
    const clienteName = hon.clients?.name || '';
    const competence = hon.competence;
    const valor = Number(hon.amount || 0);

    // Buscar a conta do cliente
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .like('code', '1.1.2.01.%')
      .ilike('name', `%${clienteName.substring(0, 15)}%`)
      .not('name', 'ilike', '%[CONSOLIDADO]%')
      .limit(1)
      .single();

    if (!contaCliente) {
      console.log(`   ⚠️  Conta não encontrada: ${clienteName}`);
      continue;
    }

    // Buscar lançamentos (items) nessa conta com o valor do honorário
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id, entry_id, debit, accounting_entries(id, description, entry_type)')
      .eq('account_id', contaCliente.id)
      .eq('debit', valor);

    // Buscar lançamentos (lines) nessa conta com o valor do honorário
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('id, entry_id, debit, accounting_entries(id, description, entry_type)')
      .eq('account_id', contaCliente.id)
      .eq('debit', valor);

    const todosLancamentos = [...(items || []), ...(lines || [])];

    // Filtrar apenas os de saldo de abertura
    const lancamentosAbertura = todosLancamentos.filter(l =>
      l.accounting_entries?.entry_type === 'SALDO_ABERTURA' ||
      l.accounting_entries?.description?.toLowerCase().includes('saldo de abertura')
    );

    if (lancamentosAbertura.length === 0) {
      // Não tem lançamento para este honorário pago
      continue;
    }

    // Pegar apenas o primeiro (evitar remover duplicatas)
    const lancamento = lancamentosAbertura[0];
    const entryId = lancamento.entry_id;

    console.log(`   Removendo: ${clienteName.substring(0, 30)} | ${competence} | R$ ${valor.toFixed(2)}`);

    // Remover items deste entry
    await supabase
      .from('accounting_entry_items')
      .delete()
      .eq('entry_id', entryId);

    // Remover lines deste entry
    await supabase
      .from('accounting_entry_lines')
      .delete()
      .eq('entry_id', entryId);

    // Remover o entry
    const { error } = await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', entryId);

    if (!error) {
      lancamentosRemovidos++;
      totalRemovido += valor;
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESULTADO:');
  console.log('='.repeat(100));
  console.log(`   Lançamentos removidos: ${lancamentosRemovidos}`);
  console.log(`   Valor total removido: R$ ${totalRemovido.toFixed(2)}`);

  // Verificar saldo final
  console.log('\n📊 Verificando saldo final...');

  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  let totalDebitos = 0;

  for (const conta of subcontas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit')
      .eq('account_id', conta.id);

    totalDebitos += (items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0);
    totalDebitos += (lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0);
  }

  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount')
    .neq('status', 'paid');

  const saldoPendente = pendentes?.reduce((s, h) => s + Number(h.amount || 0) - Number(h.paid_amount || 0), 0) || 0;

  console.log(`   Saldo contábil: R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Saldo pendente: R$ ${saldoPendente.toFixed(2)}`);
  console.log(`   Diferença: R$ ${(totalDebitos - saldoPendente).toFixed(2)}`);

  if (Math.abs(totalDebitos - saldoPendente) < 100) {
    console.log('\n✅ SALDOS CONFEREM!');
  } else {
    console.log('\n⚠️  Ainda há diferença - pode haver outros lançamentos');
  }

  console.log('='.repeat(100));
}

remover().catch(console.error);
