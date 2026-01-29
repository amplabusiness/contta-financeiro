// scripts/correcao_contabil/50_verificar_tabelas_contabeis.cjs
// Verificar se ambas as tabelas accounting_entry_lines e accounting_entry_items existem e tem dados

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO TABELAS CONTÁBEIS');
  console.log('='.repeat(100));

  // 1. Verificar accounting_entry_lines
  console.log('\n📊 TABELA: accounting_entry_lines');
  const { data: lines, error: linesError, count: linesCount } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true });

  if (linesError) {
    console.log('   ❌ Erro:', linesError.message);
  } else {
    console.log('   ✅ Total de registros:', linesCount);

    // Buscar amostra
    const { data: lineSample } = await supabase
      .from('accounting_entry_lines')
      .select('*, accounting_entries(entry_date, description)')
      .limit(5);

    console.log('   📋 Amostra:');
    lineSample?.forEach(l => {
      console.log(`      - ${l.accounting_entries?.entry_date} | D: ${l.debit || 0} | C: ${l.credit || 0} | ${l.accounting_entries?.description?.substring(0, 50)}`);
    });
  }

  // 2. Verificar accounting_entry_items
  console.log('\n📊 TABELA: accounting_entry_items');
  const { data: items, error: itemsError, count: itemsCount } = await supabase
    .from('accounting_entry_items')
    .select('*', { count: 'exact', head: true });

  if (itemsError) {
    console.log('   ❌ Erro:', itemsError.message);
  } else {
    console.log('   ✅ Total de registros:', itemsCount);

    // Buscar amostra
    const { data: itemSample } = await supabase
      .from('accounting_entry_items')
      .select('*, accounting_entries(entry_date, description)')
      .limit(5);

    console.log('   📋 Amostra:');
    itemSample?.forEach(i => {
      console.log(`      - ${i.accounting_entries?.entry_date} | D: ${i.debit || 0} | C: ${i.credit || 0} | ${i.accounting_entries?.description?.substring(0, 50)}`);
    });
  }

  // 3. Verificar conta 1.1.2.01 (Clientes a Receber)
  console.log('\n📊 CONTA 1.1.2.01 (Clientes a Receber):');

  const { data: contaReceber } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01')
    .single();

  if (contaReceber) {
    console.log(`   Conta encontrada: ${contaReceber.name}`);

    // Verificar em accounting_entry_lines
    const { data: receberLines, count: receberLinesCount } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit', { count: 'exact' })
      .eq('account_id', contaReceber.id);

    const linesTotalD = receberLines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
    const linesTotalC = receberLines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;

    console.log(`   accounting_entry_lines: ${receberLinesCount} registros | D: ${linesTotalD.toFixed(2)} | C: ${linesTotalC.toFixed(2)} | Saldo: ${(linesTotalD - linesTotalC).toFixed(2)}`);

    // Verificar em accounting_entry_items
    const { data: receberItems, count: receberItemsCount } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit', { count: 'exact' })
      .eq('account_id', contaReceber.id);

    const itemsTotalD = receberItems?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const itemsTotalC = receberItems?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;

    console.log(`   accounting_entry_items: ${receberItemsCount} registros | D: ${itemsTotalD.toFixed(2)} | C: ${itemsTotalC.toFixed(2)} | Saldo: ${(itemsTotalD - itemsTotalC).toFixed(2)}`);

    // Saldo total combinado
    const saldoTotal = (linesTotalD + itemsTotalD) - (linesTotalC + itemsTotalC);
    console.log(`   \n   📌 SALDO TOTAL COMBINADO: R$ ${saldoTotal.toFixed(2)}`);
  }

  // 4. Verificar conta banco (1.1.1.05)
  console.log('\n📊 CONTA 1.1.1.05 (Banco Sicredi):');

  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.05')
    .single();

  if (contaBanco) {
    console.log(`   Conta encontrada: ${contaBanco.name}`);

    // Verificar em accounting_entry_lines
    const { data: bancoLines, count: bancoLinesCount } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit', { count: 'exact' })
      .eq('account_id', contaBanco.id);

    const bancoLinesTotalD = bancoLines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
    const bancoLinesTotalC = bancoLines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;

    console.log(`   accounting_entry_lines: ${bancoLinesCount} registros | D: ${bancoLinesTotalD.toFixed(2)} | C: ${bancoLinesTotalC.toFixed(2)} | Saldo: ${(bancoLinesTotalD - bancoLinesTotalC).toFixed(2)}`);

    // Verificar em accounting_entry_items
    const { data: bancoItems, count: bancoItemsCount } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit', { count: 'exact' })
      .eq('account_id', contaBanco.id);

    const bancoItemsTotalD = bancoItems?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const bancoItemsTotalC = bancoItems?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;

    console.log(`   accounting_entry_items: ${bancoItemsCount} registros | D: ${bancoItemsTotalD.toFixed(2)} | C: ${bancoItemsTotalC.toFixed(2)} | Saldo: ${(bancoItemsTotalD - bancoItemsTotalC).toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('DIAGNÓSTICO COMPLETO');
  console.log('='.repeat(100));
}

verificar().catch(console.error);
