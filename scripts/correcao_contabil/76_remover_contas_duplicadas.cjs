// scripts/correcao_contabil/76_remover_contas_duplicadas.cjs
// Remover contas duplicadas criadas erroneamente e seus lançamentos

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Contas criadas erroneamente pelo script anterior
const CONTAS_REMOVER = [
  '1.1.2.01.10004', // PM ADMINSTRAÇÃO duplicada
  '1.1.2.01.10007', // UNICAIXAS duplicada
];

async function removerDuplicadas() {
  console.log('='.repeat(100));
  console.log('REMOVENDO CONTAS DUPLICADAS E LANÇAMENTOS');
  console.log('='.repeat(100));

  for (const codigo of CONTAS_REMOVER) {
    console.log(`\n🔍 Processando conta: ${codigo}`);

    // Buscar a conta
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', codigo)
      .single();

    if (!conta) {
      console.log(`   ⚠️  Conta não encontrada: ${codigo}`);
      continue;
    }

    console.log(`   Encontrada: ${conta.name}`);

    // Buscar items nesta conta
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id, entry_id, debit, credit')
      .eq('account_id', conta.id);

    console.log(`   Items encontrados: ${items?.length || 0}`);

    // Para cada item, verificar se é o único no entry
    const entryIds = new Set();
    for (const item of items || []) {
      entryIds.add(item.entry_id);
    }

    // Remover items desta conta
    if (items?.length > 0) {
      const { error: errDel } = await supabase
        .from('accounting_entry_items')
        .delete()
        .eq('account_id', conta.id);

      if (errDel) {
        console.log(`   ❌ Erro ao remover items: ${errDel.message}`);
      } else {
        console.log(`   ✅ Items removidos: ${items.length}`);
      }
    }

    // Para cada entry, verificar se ficou vazio e remover
    for (const entryId of entryIds) {
      const { data: remainingItems } = await supabase
        .from('accounting_entry_items')
        .select('id')
        .eq('entry_id', entryId);

      if (!remainingItems?.length) {
        // Entry ficou vazio, remover
        const { error: errEntry } = await supabase
          .from('accounting_entries')
          .delete()
          .eq('id', entryId);

        if (!errEntry) {
          console.log(`   ✅ Entry vazio removido`);
        }
      }
    }

    // Remover a conta
    const { error: errConta } = await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('id', conta.id);

    if (errConta) {
      console.log(`   ❌ Erro ao remover conta: ${errConta.message}`);
    } else {
      console.log(`   ✅ Conta removida: ${codigo}`);
    }
  }

  // Verificar saldo final
  console.log('\n' + '='.repeat(100));
  console.log('📊 VERIFICANDO SALDO FINAL:');
  console.log('='.repeat(100));

  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  let totalContabil = 0;
  for (const conta of subcontas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const saldo = (items?.reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0) || 0) +
                  (lines?.reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0) || 0);

    if (saldo !== 0) {
      totalContabil += saldo;
    }
  }

  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount')
    .neq('status', 'paid');

  const totalPendente = pendentes?.reduce((s, h) => s + Number(h.amount || 0) - Number(h.paid_amount || 0), 0) || 0;

  console.log(`   Saldo Contábil: R$ ${totalContabil.toFixed(2)}`);
  console.log(`   Saldo Pendente: R$ ${totalPendente.toFixed(2)}`);
  console.log(`   Diferença: R$ ${(totalPendente - totalContabil).toFixed(2)}`);
  console.log('='.repeat(100));
}

removerDuplicadas().catch(console.error);
