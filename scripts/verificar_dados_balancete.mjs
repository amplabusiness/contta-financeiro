// Script para verificar dados do balancete
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function verificar() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICAÇÃO DE DADOS PARA BALANCETE                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // 1. Verificar chart_of_accounts
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, nature, is_analytical, account_type')
    .order('code')
    .limit(20);

  console.log('1. AMOSTRA DE CONTAS:');
  console.log('═'.repeat(80));
  for (const c of contas || []) {
    console.log(`   ${c.code.padEnd(15)} | ${c.nature?.padEnd(10) || 'NULL'.padEnd(10)} | ${c.is_analytical ? 'ANALITICA' : 'SINTETICA'} | ${c.name?.substring(0, 30)}`);
  }

  // 2. Verificar entry_types
  console.log('\n\n2. ENTRY_TYPES USADOS:');
  console.log('═'.repeat(80));
  const { data: types } = await supabase
    .from('accounting_entries')
    .select('entry_type')
    .neq('is_draft', true);

  const typeCounts = {};
  for (const t of types || []) {
    const et = t.entry_type || 'NULL';
    typeCounts[et] = (typeCounts[et] || 0) + 1;
  }

  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`   ${type.padEnd(30)}: ${count}`);
  }

  // 3. Verificar items
  console.log('\n\n3. AMOSTRA DE ITEMS COM VALORES:');
  console.log('═'.repeat(80));
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select(`
      debit,
      credit,
      account:chart_of_accounts(code, name)
    `)
    .or('debit.gt.0,credit.gt.0')
    .limit(10);

  for (const i of items || []) {
    console.log(`   ${i.account?.code?.padEnd(15)} | D: ${String(i.debit).padStart(10)} | C: ${String(i.credit).padStart(10)} | ${i.account?.name?.substring(0, 30)}`);
  }

  // 4. Verificar se existem contas com nature NULL
  const { count: nullNature } = await supabase
    .from('chart_of_accounts')
    .select('*', { count: 'exact', head: true })
    .is('nature', null);

  console.log(`\n\n4. CONTAS COM NATURE NULL: ${nullNature}`);

  // 5. Testar a função diretamente
  console.log('\n\n5. TESTANDO FUNÇÃO get_account_balances:');
  console.log('═'.repeat(80));
  const { data: balancete, error: balError } = await supabase
    .rpc('get_account_balances', {
      p_period_start: '2025-01-01',
      p_period_end: '2025-12-31'
    });

  if (balError) {
    console.log(`   ❌ Erro: ${balError.message}`);
  } else {
    // Mostrar contas com movimento
    const contasComMovimento = (balancete || []).filter(b =>
      Math.abs(Number(b.total_debits || 0)) > 0.01 ||
      Math.abs(Number(b.total_credits || 0)) > 0.01 ||
      Math.abs(Number(b.closing_balance || 0)) > 0.01
    );

    console.log(`   Total de contas retornadas: ${balancete?.length || 0}`);
    console.log(`   Contas com movimento: ${contasComMovimento.length}`);

    if (contasComMovimento.length > 0) {
      console.log('\n   Primeiras 10 contas com movimento:');
      for (const c of contasComMovimento.slice(0, 10)) {
        console.log(`   ${c.account_code?.padEnd(15)} | D: ${String(Number(c.total_debits || 0).toFixed(2)).padStart(12)} | C: ${String(Number(c.total_credits || 0).toFixed(2)).padStart(12)} | SF: ${String(Number(c.closing_balance || 0).toFixed(2)).padStart(12)}`);
      }
    } else {
      console.log('\n   ⚠️ NENHUMA CONTA COM MOVIMENTO RETORNADA!');
      console.log('   Isso indica problema na função ou nos dados.');
    }
  }

  // 6. Query manual para confirmar que existem dados
  console.log('\n\n6. VERIFICANDO DADOS MANUAIS:');
  console.log('═'.repeat(80));

  const { data: manual } = await supabase
    .from('accounting_entry_items')
    .select(`
      debit,
      credit,
      entry:accounting_entries!inner(entry_date, competence_date, entry_type, is_draft),
      account:chart_of_accounts(code, nature, is_analytical)
    `)
    .eq('entry.is_draft', false)
    .gte('entry.entry_date', '2025-01-01')
    .lte('entry.entry_date', '2025-12-31')
    .limit(100);

  console.log(`   Items encontrados no período: ${manual?.length || 0}`);

  // Somar por código de conta
  const somaPorConta = {};
  for (const m of manual || []) {
    const code = m.account?.code || 'SEM_CONTA';
    if (!somaPorConta[code]) somaPorConta[code] = { debit: 0, credit: 0 };
    somaPorConta[code].debit += Number(m.debit || 0);
    somaPorConta[code].credit += Number(m.credit || 0);
  }

  console.log('\n   Somas por conta (amostra):');
  const entries = Object.entries(somaPorConta).slice(0, 10);
  for (const [code, sums] of entries) {
    console.log(`   ${code.padEnd(15)} | D: ${sums.debit.toFixed(2).padStart(12)} | C: ${sums.credit.toFixed(2).padStart(12)}`);
  }
}

verificar().catch(console.error);
