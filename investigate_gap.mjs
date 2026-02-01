import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);
const t = 'a53a4957-fe97-4856-b3ca-70045157b421';
const TRANS_DEB = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
const TRANS_CRED = '28085461-9e5a-4fb4-847d-c9fc047fe0a1';

async function main() {
  console.log('=== INVESTIGAÇÃO GAPS TRANSITÓRIAS ===\n');

  // 1. Resultado da RPC (já funcionando)
  const { data: rpcData } = await supabase.rpc('generate_monthly_audit_data', {
    p_tenant_id: t,
    p_year: 2025,
    p_month: 1
  });

  console.log('SALDOS DAS TRANSITÓRIAS (via RPC):');
  console.log('  1.1.9.01 Débitos:', rpcData?.transitorias?.debitos?.saldo, '→', rpcData?.transitorias?.debitos?.status);
  console.log('  2.1.9.01 Créditos:', rpcData?.transitorias?.creditos?.saldo, '→', rpcData?.transitorias?.creditos?.status);

  // 2. Transações de Janeiro que NÃO têm journal_entry_id
  const { data: pendentes } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, amount, description')
    .eq('tenant_id', t)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .is('journal_entry_id', null);

  console.log('\n\nTRANSAÇÕES SEM JOURNAL_ENTRY_ID:', pendentes?.length || 0);

  // 3. Verificar quantos lançamentos por source_type
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, source_type, description')
    .eq('tenant_id', t)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log('\n\nLANÇAMENTOS POR SOURCE_TYPE:');
  const byType = {};
  entries?.forEach(e => {
    const st = e.source_type || 'NULL';
    byType[st] = (byType[st] || 0) + 1;
  });
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // 4. Verificar se existem lançamentos de classificação
  const classCount = entries?.filter(e => 
    e.source_type === 'classification' || 
    e.source_type === 'CLASSIFICATION' ||
    e.source_type === 'reclassification'
  ).length || 0;
  
  console.log(`\n\nLANÇAMENTOS DE CLASSIFICAÇÃO: ${classCount}`);

  // 5. Diagnóstico
  console.log('\n' + '='.repeat(60));
  console.log('DIAGNÓSTICO DR. CÍCERO');
  console.log('='.repeat(60));

  const saldoDeb = rpcData?.transitorias?.debitos?.saldo || 0;
  const saldoCred = rpcData?.transitorias?.creditos?.saldo || 0;

  if (Math.abs(saldoDeb) > 0.01 || Math.abs(saldoCred) > 0.01) {
    console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
    console.log('    Transitórias NÃO estão zeradas.');
    console.log(`    1.1.9.01 (saídas pendentes): R$ ${saldoDeb?.toFixed(2)}`);
    console.log(`    2.1.9.01 (entradas pendentes): R$ ${saldoCred?.toFixed(2)}`);
    
    if (classCount === 0) {
      console.log('\n🔴 CAUSA PROVÁVEL:');
      console.log('    Nenhum lançamento de CLASSIFICAÇÃO encontrado.');
      console.log('    As transações foram importadas (OFX) mas não classificadas.');
    } else {
      console.log('\n🟡 CAUSA PROVÁVEL:');
      console.log(`    Existem ${classCount} classificações, mas são insuficientes.`);
      console.log('    Verificar se todas as transações OFX foram classificadas.');
    }
  }
}

main().catch(console.error);
