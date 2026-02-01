const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const tenantId = 'a53a4957-fe97-4856-b3ca-70045157b421';

(async () => {
  console.log('\n=== DR. CÍCERO - PARECER TÉCNICO ===');
  console.log('Análise: Janeiro/2025\n');

  // 1. Transações pendentes
  const { data: pendentes } = await supabase
    .from('bank_transactions')
    .select('transaction_date, amount, description, status, journal_entry_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  console.log('1. TRANSAÇÕES COM STATUS "PENDING" (31 encontradas):');
  console.log('---------------------------------------------------');
  
  let totalEntradas = 0;
  let totalSaidas = 0;
  
  pendentes?.forEach((x, i) => {
    const valor = x.amount > 0 ? `+${x.amount.toFixed(2)}` : x.amount.toFixed(2);
    const temLanc = x.journal_entry_id ? '✅' : '❌';
    console.log(`${(i+1).toString().padStart(2)}. ${x.transaction_date} | ${valor.padStart(12)} | ${temLanc} | ${x.description?.substring(0, 40)}`);
    if (x.amount > 0) totalEntradas += x.amount;
    else totalSaidas += Math.abs(x.amount);
  });

  console.log('\n   Total Entradas: R$', totalEntradas.toFixed(2));
  console.log('   Total Saídas: R$', totalSaidas.toFixed(2));

  // 2. Verificar se têm lançamentos
  const comLancamento = pendentes?.filter(x => x.journal_entry_id).length || 0;
  const semLancamento = pendentes?.filter(x => !x.journal_entry_id).length || 0;

  console.log('\n2. SITUAÇÃO DOS LANÇAMENTOS:');
  console.log('----------------------------');
  console.log('   Com lançamento vinculado:', comLancamento);
  console.log('   Sem lançamento vinculado:', semLancamento);

  // 3. Verificar transitórias
  const { data: linhasDebitos } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('tenant_id', tenantId)
    .eq('account_id', '3e1fd22f-fba2-4cc2-b628-9d729233bca0');

  const { data: linhasCreditos } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('tenant_id', tenantId)
    .eq('account_id', '28085461-9e5a-4fb4-847d-c9fc047fe0a1');

  const saldoDebitos = linhasDebitos?.reduce((a, l) => a + (l.debit || 0) - (l.credit || 0), 0) || 0;
  const saldoCreditos = linhasCreditos?.reduce((a, l) => a + (l.credit || 0) - (l.debit || 0), 0) || 0;

  console.log('\n3. SALDO DAS TRANSITÓRIAS:');
  console.log('--------------------------');
  console.log('   1.1.9.01 Transitória Débitos: R$', saldoDebitos.toFixed(2), saldoDebitos === 0 ? '✅ ZERADA' : '⚠️');
  console.log('   2.1.9.01 Transitória Créditos: R$', saldoCreditos.toFixed(2), saldoCreditos === 0 ? '✅ ZERADA' : '⚠️');

  // 4. Diagnóstico
  console.log('\n4. DIAGNÓSTICO DO DR. CÍCERO:');
  console.log('-----------------------------');
  
  if (comLancamento === pendentes?.length && saldoDebitos === 0 && saldoCreditos === 0) {
    console.log('   ✅ Todas as 31 transações JÁ POSSUEM lançamentos contábeis.');
    console.log('   ✅ As transitórias estão ZERADAS.');
    console.log('   ⚠️ PORÉM o status das transações continua como "pending".');
    console.log('\n   AÇÃO RECOMENDADA:');
    console.log('   Atualizar o status das 31 transações para "reconciled"');
    console.log('   pois os lançamentos já existem e estão classificados.');
  } else if (semLancamento > 0) {
    console.log('   ❌ Existem', semLancamento, 'transações SEM lançamento contábil.');
    console.log('   AÇÃO: Criar os lançamentos de importação OFX primeiro.');
  }

  console.log('\n========================================\n');
})();
