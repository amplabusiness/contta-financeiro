// scripts/correcao_contabil/62_verificar_lancamentos_jan2025.cjs
// Verificar lançamentos com data em janeiro/2025

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO LANÇAMENTOS EM JANEIRO/2025');
  console.log('='.repeat(100));

  // 1. Buscar contas específicas mencionadas
  const contasVerificar = [
    '1.1.2.01.0004', // RESTAURANTE IUVACI - Débitos R$ 713,38
    '1.1.2.01.0007', // VERDI - Débitos R$ 2.118,07
    '1.1.2.01.0006', // TIMES
  ];

  for (const codigo of contasVerificar) {
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', codigo)
      .single();

    if (!conta) continue;

    console.log(`\n📊 ${conta.code} - ${conta.name}`);

    // Buscar lançamentos em janeiro/2025 (2025-01-01 a 2025-01-31)
    const { data: itemsJan } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit, accounting_entries!inner(entry_date, description)')
      .eq('account_id', conta.id)
      .gte('accounting_entries.entry_date', '2025-01-01')
      .lte('accounting_entries.entry_date', '2025-01-31');

    const { data: linesJan } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit, accounting_entries!inner(entry_date, description)')
      .eq('account_id', conta.id)
      .gte('accounting_entries.entry_date', '2025-01-01')
      .lte('accounting_entries.entry_date', '2025-01-31');

    console.log(`   Lançamentos em JAN/2025 (items): ${itemsJan?.length || 0}`);
    itemsJan?.forEach(i => {
      console.log(`      ${i.accounting_entries?.entry_date} | D: ${i.debit || 0} | C: ${i.credit || 0} | ${i.accounting_entries?.description?.substring(0, 50)}`);
    });

    console.log(`   Lançamentos em JAN/2025 (lines): ${linesJan?.length || 0}`);
    linesJan?.forEach(l => {
      console.log(`      ${l.accounting_entries?.entry_date} | D: ${l.debit || 0} | C: ${l.credit || 0} | ${l.accounting_entries?.description?.substring(0, 50)}`);
    });

    // Buscar lançamentos ANTES de janeiro/2025 (saldo inicial)
    const { data: itemsAntes } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id)
      .lt('accounting_entries.entry_date', '2025-01-01');

    const { data: linesAntes } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id)
      .lt('accounting_entries.entry_date', '2025-01-01');

    const siD = (itemsAntes?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0) +
               (linesAntes?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0);
    const siC = (itemsAntes?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0) +
               (linesAntes?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0);

    console.log(`   Saldo Inicial (até 31/12/2024): D=${siD.toFixed(2)} | C=${siC.toFixed(2)} | Saldo=${(siD-siC).toFixed(2)}`);
  }

  // 2. Buscar TODOS os lançamentos de janeiro/2025 em contas de clientes
  console.log('\n' + '='.repeat(100));
  console.log('TODOS OS LANÇAMENTOS DE CLIENTES EM JANEIRO/2025');
  console.log('='.repeat(100));

  const { data: todasContas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  const contaIds = todasContas?.map(c => c.id) || [];

  const { data: todosItemsJan } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, account_id, accounting_entries!inner(entry_date, description)')
    .in('account_id', contaIds)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  const { data: todasLinesJan } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, account_id, accounting_entries!inner(entry_date, description)')
    .in('account_id', contaIds)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  console.log(`\nTotal items em JAN/2025: ${todosItemsJan?.length || 0}`);
  console.log(`Total lines em JAN/2025: ${todasLinesJan?.length || 0}`);

  // Listar todos
  const todos = [...(todosItemsJan || []), ...(todasLinesJan || [])];
  const contaMap = {};
  todasContas?.forEach(c => contaMap[c.id] = c);

  todos.forEach(l => {
    const conta = contaMap[l.account_id];
    console.log(`   ${l.accounting_entries?.entry_date} | ${conta?.code} | D: ${l.debit || 0} | C: ${l.credit || 0} | ${l.accounting_entries?.description?.substring(0, 40)}`);
  });
}

verificar().catch(console.error);
