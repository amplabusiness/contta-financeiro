// scripts/correcao_contabil/51_verificar_honorarios_contas.cjs
// Verificar em quais contas os honorários foram lançados

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO HONORÁRIOS E SUAS CONTAS CONTÁBEIS');
  console.log('='.repeat(100));

  // 1. Buscar entries de saldo de abertura (TIMES e RODRIGO)
  console.log('\n📊 ENTRIES DE SALDO DE ABERTURA (TIMES e RODRIGO):');

  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .or('description.ilike.%TIMES%,description.ilike.%RODRIGO%')
    .order('entry_date');

  console.log(`   Encontrados: ${entries?.length || 0} entries`);

  for (const entry of entries || []) {
    console.log(`\n   📋 ${entry.entry_date} - ${entry.description.substring(0, 60)}`);
    console.log(`      ID: ${entry.id}`);

    // Buscar items deste entry em accounting_entry_items
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('*, chart_of_accounts(code, name)')
      .eq('entry_id', entry.id);

    if (items?.length > 0) {
      console.log('      📝 Itens (accounting_entry_items):');
      items.forEach(item => {
        const tipo = item.debit > 0 ? 'D' : 'C';
        const valor = item.debit > 0 ? item.debit : item.credit;
        console.log(`         ${tipo} ${valor.toFixed(2)} - ${item.chart_of_accounts?.code} ${item.chart_of_accounts?.name}`);
      });
    }

    // Buscar items deste entry em accounting_entry_lines
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('*, chart_of_accounts(code, name)')
      .eq('entry_id', entry.id);

    if (lines?.length > 0) {
      console.log('      📝 Linhas (accounting_entry_lines):');
      lines.forEach(line => {
        const tipo = line.debit > 0 ? 'D' : 'C';
        const valor = line.debit > 0 ? line.debit : line.credit;
        console.log(`         ${tipo} ${valor.toFixed(2)} - ${line.chart_of_accounts?.code} ${line.chart_of_accounts?.name}`);
      });
    }

    if (!items?.length && !lines?.length) {
      console.log('      ⚠️  SEM ITENS/LINHAS ASSOCIADOS!');
    }
  }

  // 2. Verificar client_opening_balance
  console.log('\n\n📊 CLIENT_OPENING_BALANCE (Honorários):');

  const { data: honorarios, count } = await supabase
    .from('client_opening_balance')
    .select('*, clients(name)', { count: 'exact' })
    .order('competence');

  console.log(`   Total de honorários: ${count}`);

  // Resumo por cliente
  const resumo = {};
  honorarios?.forEach(h => {
    const cliente = h.clients?.name || 'SEM CLIENTE';
    if (!resumo[cliente]) resumo[cliente] = { qtd: 0, total: 0, pendente: 0 };
    resumo[cliente].qtd++;
    resumo[cliente].total += Number(h.amount || 0);
    if (h.status !== 'paid') {
      resumo[cliente].pendente += Number(h.amount || 0) - Number(h.paid_amount || 0);
    }
  });

  console.log('\n   Resumo por cliente:');
  Object.entries(resumo).forEach(([cliente, dados]) => {
    console.log(`      ${cliente}: ${dados.qtd} honorários | Total: R$ ${dados.total.toFixed(2)} | Pendente: R$ ${dados.pendente.toFixed(2)}`);
  });

  // 3. Verificar subcontas de clientes (1.1.2.01.*)
  console.log('\n\n📊 SUBCONTAS DE CLIENTES (1.1.2.01.*):');

  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .order('code');

  console.log(`   Encontradas: ${subcontas?.length || 0} subcontas`);

  for (const conta of subcontas || []) {
    // Verificar saldo em accounting_entry_items
    const { data: itemsSaldo } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const itemsD = itemsSaldo?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const itemsC = itemsSaldo?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;

    // Verificar saldo em accounting_entry_lines
    const { data: linesSaldo } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const linesD = linesSaldo?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
    const linesC = linesSaldo?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;

    const saldo = (itemsD + linesD) - (itemsC + linesC);
    if (saldo !== 0 || itemsSaldo?.length || linesSaldo?.length) {
      console.log(`   ${conta.code} - ${conta.name}: Saldo R$ ${saldo.toFixed(2)} (items: ${itemsSaldo?.length || 0}, lines: ${linesSaldo?.length || 0})`);
    }
  }

  console.log('\n' + '='.repeat(100));
}

verificar().catch(console.error);
