// scripts/correcao_contabil/58_testar_getAccountBalance.cjs
// Simular a lógica corrigida de getAccountBalance

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testarGetAccountBalance(accountCode, year, month) {
  console.log(`\n📊 Testando getAccountBalance("${accountCode}", ${year}, ${month})`);
  console.log('='.repeat(80));

  // 1. Buscar conta principal
  const { data: account } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, nature, is_analytical')
    .eq('code', accountCode)
    .single();

  if (!account) {
    console.log('❌ Conta não encontrada');
    return;
  }

  console.log(`   Conta: ${account.code} - ${account.name}`);
  console.log(`   Natureza: ${account.nature} | Analítica: ${account.is_analytical}`);

  // 2. Buscar subcontas (se sintética)
  const accountIds = [account.id];

  if (!account.is_analytical) {
    const { data: subAccounts } = await supabase
      .from('chart_of_accounts')
      .select('id, name')
      .like('code', `${accountCode}.%`)
      .not('name', 'ilike', '%[CONSOLIDADO]%');

    if (subAccounts?.length) {
      subAccounts.forEach(sub => accountIds.push(sub.id));
    }
    console.log(`   Subcontas encontradas: ${(subAccounts?.length || 0)}`);
  }

  // 3. Calcular datas
  let startDate = null;
  let endDate = null;

  if (year && month) {
    startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    endDate = new Date(year, month, 0).toISOString().split('T')[0];
  } else if (year) {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  console.log(`   Período: ${startDate || 'início'} até ${endDate || 'fim'}`);

  // 4. Buscar saldo inicial (antes do período)
  let openingDebit = 0;
  let openingCredit = 0;

  if (startDate) {
    // De accounting_entry_items
    for (const accId of accountIds) {
      const { data: priorItems } = await supabase
        .from('accounting_entry_items')
        .select('debit, credit, accounting_entries!inner(entry_date)')
        .eq('account_id', accId)
        .lt('accounting_entries.entry_date', startDate);

      openingDebit += priorItems?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
      openingCredit += priorItems?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;

      // De accounting_entry_lines
      const { data: priorLines } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, accounting_entries!inner(entry_date)')
        .eq('account_id', accId)
        .lt('accounting_entries.entry_date', startDate);

      openingDebit += priorLines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
      openingCredit += priorLines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;
    }
  }

  const openingBalance = account.nature === 'DEVEDORA'
    ? openingDebit - openingCredit
    : openingCredit - openingDebit;

  // 5. Buscar movimentos do período
  let periodDebit = 0;
  let periodCredit = 0;

  for (const accId of accountIds) {
    // De accounting_entry_items
    let itemsQuery = supabase
      .from('accounting_entry_items')
      .select('debit, credit, accounting_entries!inner(entry_date)')
      .eq('account_id', accId);

    if (startDate && endDate) {
      itemsQuery = itemsQuery
        .gte('accounting_entries.entry_date', startDate)
        .lte('accounting_entries.entry_date', endDate);
    }

    const { data: periodItems } = await itemsQuery;
    periodDebit += periodItems?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    periodCredit += periodItems?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;

    // De accounting_entry_lines
    let linesQuery = supabase
      .from('accounting_entry_lines')
      .select('debit, credit, accounting_entries!inner(entry_date)')
      .eq('account_id', accId);

    if (startDate && endDate) {
      linesQuery = linesQuery
        .gte('accounting_entries.entry_date', startDate)
        .lte('accounting_entries.entry_date', endDate);
    }

    const { data: periodLines } = await linesQuery;
    periodDebit += periodLines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
    periodCredit += periodLines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;
  }

  // 6. Calcular saldo final
  const balance = account.nature === 'DEVEDORA'
    ? openingBalance + periodDebit - periodCredit
    : openingBalance + periodCredit - periodDebit;

  console.log('\n   📋 RESULTADO:');
  console.log(`   Saldo Inicial: R$ ${openingBalance.toFixed(2)} (D: ${openingDebit.toFixed(2)} / C: ${openingCredit.toFixed(2)})`);
  console.log(`   Débitos período: R$ ${periodDebit.toFixed(2)}`);
  console.log(`   Créditos período: R$ ${periodCredit.toFixed(2)}`);
  console.log(`   🎯 SALDO FINAL: R$ ${balance.toFixed(2)}`);

  return { openingBalance, debit: periodDebit, credit: periodCredit, balance };
}

async function main() {
  console.log('='.repeat(100));
  console.log('TESTE DA FUNÇÃO getAccountBalance CORRIGIDA');
  console.log('='.repeat(100));

  // Testar com janeiro/2026
  await testarGetAccountBalance('1.1.2.01', 2026, 1);

  // Testar sem filtro de data (todo o histórico)
  await testarGetAccountBalance('1.1.2.01', null, null);

  // Testar banco
  await testarGetAccountBalance('1.1.1.05', 2026, 1);
}

main().catch(console.error);
