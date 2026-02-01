import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const tenantId = 'a53a4957-fe97-4856-b3ca-70045157b421';
const TRANS_DEB = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
const TRANS_CRED = '28085461-9e5a-4fb4-847d-c9fc047fe0a1';

async function main() {
  console.log('='.repeat(70));
  console.log('ANÁLISE DE GAPS NAS TRANSITÓRIAS - Janeiro/2025');
  console.log('='.repeat(70));

  // 1. Buscar todas as linhas nas transitórias
  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      account_id,
      debit,
      credit,
      description,
      accounting_entries!inner(
        id,
        entry_date,
        description,
        source_type,
        internal_code
      )
    `)
    .eq('tenant_id', tenantId)
    .in('account_id', [TRANS_DEB, TRANS_CRED])
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  console.log(`\nTotal de linhas nas transitórias: ${lines?.length || 0}`);

  // Agrupar por source_type
  const bySource = {};
  lines?.forEach(l => {
    const src = l.accounting_entries.source_type || 'NULL';
    const acc = l.account_id === TRANS_DEB ? '1.1.9.01' : '2.1.9.01';
    
    if (!bySource[src]) {
      bySource[src] = {
        '1.1.9.01': { debitos: 0, creditos: 0, count: 0 },
        '2.1.9.01': { debitos: 0, creditos: 0, count: 0 }
      };
    }
    
    bySource[src][acc].debitos += l.debit || 0;
    bySource[src][acc].creditos += l.credit || 0;
    bySource[src][acc].count++;
  });

  console.log('\n' + '='.repeat(70));
  console.log('MOVIMENTAÇÃO POR SOURCE_TYPE');
  console.log('='.repeat(70));
  
  Object.entries(bySource).forEach(([src, contas]) => {
    console.log(`\n📌 ${src}:`);
    
    Object.entries(contas).forEach(([conta, vals]) => {
      if (vals.count > 0) {
        const saldo = conta === '1.1.9.01' 
          ? vals.debitos - vals.creditos 
          : vals.creditos - vals.debitos;
        console.log(`   ${conta}: D=${vals.debitos.toFixed(2).padStart(12)} C=${vals.creditos.toFixed(2).padStart(12)} | Saldo=${saldo.toFixed(2).padStart(12)} (${vals.count} linhas)`);
      }
    });
  });

  // 2. Calcular totais
  console.log('\n' + '='.repeat(70));
  console.log('RESUMO TOTAL');
  console.log('='.repeat(70));
  
  let totalDebDeb = 0, totalDebCred = 0;
  let totalCredDeb = 0, totalCredCred = 0;
  
  Object.values(bySource).forEach(contas => {
    totalDebDeb += contas['1.1.9.01'].debitos;
    totalDebCred += contas['1.1.9.01'].creditos;
    totalCredDeb += contas['2.1.9.01'].debitos;
    totalCredCred += contas['2.1.9.01'].creditos;
  });

  console.log(`\n1.1.9.01 (Transitória Débitos):`);
  console.log(`   Total Débitos:  R$ ${totalDebDeb.toFixed(2)}`);
  console.log(`   Total Créditos: R$ ${totalDebCred.toFixed(2)}`);
  console.log(`   SALDO:          R$ ${(totalDebDeb - totalDebCred).toFixed(2)}`);
  
  console.log(`\n2.1.9.01 (Transitória Créditos):`);
  console.log(`   Total Débitos:  R$ ${totalCredDeb.toFixed(2)}`);
  console.log(`   Total Créditos: R$ ${totalCredCred.toFixed(2)}`);
  console.log(`   SALDO:          R$ ${(totalCredCred - totalCredDeb).toFixed(2)}`);

  // 3. Identificar source_types que NÃO zeram
  console.log('\n' + '='.repeat(70));
  console.log('DIAGNÓSTICO: SOURCE_TYPES QUE DEIXARAM SALDO');
  console.log('='.repeat(70));
  
  Object.entries(bySource).forEach(([src, contas]) => {
    const saldo119 = contas['1.1.9.01'].debitos - contas['1.1.9.01'].creditos;
    const saldo219 = contas['2.1.9.01'].creditos - contas['2.1.9.01'].debitos;
    
    if (Math.abs(saldo119) > 0.01 || Math.abs(saldo219) > 0.01) {
      console.log(`\n⚠️  ${src}:`);
      if (Math.abs(saldo119) > 0.01) {
        console.log(`    1.1.9.01 saldo pendente: R$ ${saldo119.toFixed(2)}`);
      }
      if (Math.abs(saldo219) > 0.01) {
        console.log(`    2.1.9.01 saldo pendente: R$ ${saldo219.toFixed(2)}`);
      }
    }
  });
}

main().catch(console.error);
