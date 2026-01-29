// scripts/correcao_contabil/67_remover_lancamentos_pagos.cjs
// Remover lançamentos de saldo de abertura para honorários que já estão PAGOS
// Conforme Dr. Cícero: só devem existir lançamentos para honorários PENDENTES

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removerLancamentosPagos() {
  console.log('='.repeat(100));
  console.log('REMOVENDO LANÇAMENTOS DE HONORÁRIOS JÁ PAGOS');
  console.log('(Conforme Dr. Cícero: só lançar honorários PENDENTES no saldo de abertura)');
  console.log('='.repeat(100));

  // 1. Buscar honorários PAGOS que têm reference_id
  const { data: honorariosPagos } = await supabase
    .from('client_opening_balance')
    .select('id, competence, amount, status, clients(name)')
    .eq('status', 'paid');

  console.log(`\n📋 Honorários PAGOS encontrados: ${honorariosPagos?.length || 0}`);

  // 2. Buscar lançamentos de saldo de abertura que referenciam esses honorários
  const idsHonorariosPagos = honorariosPagos?.map(h => h.id) || [];

  if (idsHonorariosPagos.length === 0) {
    console.log('✅ Nenhum honorário pago encontrado.');
    return;
  }

  // 3. Buscar entries que referenciam honorários pagos
  const { data: entriesParaRemover } = await supabase
    .from('accounting_entries')
    .select('id, description, reference_id')
    .eq('reference_type', 'client_opening_balance')
    .in('reference_id', idsHonorariosPagos);

  console.log(`\n📋 Lançamentos associados a honorários PAGOS: ${entriesParaRemover?.length || 0}`);

  if (!entriesParaRemover?.length) {
    console.log('✅ Nenhum lançamento para remover.');

    // Verificar se os lançamentos foram criados sem reference_id
    console.log('\n⚠️  Verificando lançamentos sem reference_id...');

    // Buscar por descrição
    let lancamentosRemovidos = 0;
    let valorRemovido = 0;

    for (const hon of honorariosPagos || []) {
      const clienteName = hon.clients?.name || '';
      const competence = hon.competence;

      // Buscar entry por descrição que contenha o cliente e competência
      const { data: entries } = await supabase
        .from('accounting_entries')
        .select('id, description')
        .ilike('description', `%${competence}%`)
        .ilike('description', `%${clienteName.substring(0, 20)}%`)
        .or('entry_type.eq.SALDO_ABERTURA,description.ilike.%Saldo de abertura%');

      for (const entry of entries || []) {
        console.log(`   Removendo: ${entry.description?.substring(0, 60)}`);

        // Remover items
        await supabase
          .from('accounting_entry_items')
          .delete()
          .eq('entry_id', entry.id);

        // Remover lines
        await supabase
          .from('accounting_entry_lines')
          .delete()
          .eq('entry_id', entry.id);

        // Remover entry
        const { error } = await supabase
          .from('accounting_entries')
          .delete()
          .eq('id', entry.id);

        if (!error) {
          lancamentosRemovidos++;
          valorRemovido += Number(hon.amount || 0);
        }
      }
    }

    console.log(`\n✅ Lançamentos removidos: ${lancamentosRemovidos}`);
    console.log(`   Valor total removido: R$ ${valorRemovido.toFixed(2)}`);
    return;
  }

  // 4. Remover os lançamentos
  console.log('\n⏳ Removendo lançamentos...');

  let removidos = 0;
  for (const entry of entriesParaRemover) {
    // Remover items primeiro (FK)
    await supabase
      .from('accounting_entry_items')
      .delete()
      .eq('entry_id', entry.id);

    // Remover lines
    await supabase
      .from('accounting_entry_lines')
      .delete()
      .eq('entry_id', entry.id);

    // Remover entry
    const { error } = await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', entry.id);

    if (!error) {
      removidos++;
      console.log(`   ✓ Removido: ${entry.description?.substring(0, 60)}`);
    }
  }

  console.log(`\n✅ ${removidos} lançamentos removidos`);

  // 5. Verificar saldo final
  console.log('\n📊 Verificando saldo final de Clientes a Receber...');

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

  // Comparar com client_opening_balance pendente
  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount')
    .neq('status', 'paid');

  const saldoPendente = pendentes?.reduce((s, h) => {
    return s + (Number(h.amount || 0) - Number(h.paid_amount || 0));
  }, 0) || 0;

  console.log(`   Saldo contábil: R$ ${saldoContabil.toFixed(2)}`);
  console.log(`   Saldo pendente (client_opening_balance): R$ ${saldoPendente.toFixed(2)}`);
  console.log(`   Diferença: R$ ${(saldoContabil - saldoPendente).toFixed(2)}`);

  if (Math.abs(saldoContabil - saldoPendente) < 100) {
    console.log('\n✅ SALDOS CONFEREM!');
  }

  console.log('\n' + '='.repeat(100));
}

removerLancamentosPagos().catch(console.error);
