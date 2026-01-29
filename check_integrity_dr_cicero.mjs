import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENANT = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function check() {
  console.log('='.repeat(70));
  console.log('VERIFICAÇÃO DE INTEGRIDADE - Dr. Cícero');
  console.log('='.repeat(70));
  
  // 1. Executar RPC de integridade
  console.log('\n1. rpc_check_accounting_integrity():');
  const { data: integrity, error: intErr } = await supabase.rpc('rpc_check_accounting_integrity', {
    p_tenant_id: TENANT
  });
  
  if (intErr) {
    console.log('   ERRO:', intErr.message);
  } else {
    console.log(JSON.stringify(integrity, null, 2));
  }
  
  // 2. Verificar transitórias
  console.log('\n2. vw_transitory_balances:');
  const { data: transit, error: trErr } = await supabase
    .from('vw_transitory_balances')
    .select('*');
  
  if (trErr) {
    console.log('   ERRO:', trErr.message);
  } else {
    transit?.forEach(t => {
      console.log(`   ${t.code} - ${t.name}`);
      console.log(`      Débito: ${t.total_debit} | Crédito: ${t.total_credit} | Saldo: ${t.balance}`);
      console.log(`      Status: ${t.status}`);
    });
  }
  
  // 3. Verificar modo manutenção
  console.log('\n3. Modo Manutenção:');
  const { data: maint } = await supabase
    .from('system_maintenance')
    .select('*')
    .eq('key', 'accounting_maintenance')
    .single();
  
  console.log('   Status:', maint?.value?.enabled ? '⚠️ LIGADO' : '✅ DESLIGADO');
  console.log('   Razão:', maint?.value?.reason || 'N/A');
  
  // 4. Contagem atual
  console.log('\n4. Contagem de Registros:');
  const { count: entries } = await supabase.from('accounting_entries').select('*', { count: 'exact', head: true });
  const { count: lines } = await supabase.from('accounting_entry_lines').select('*', { count: 'exact', head: true });
  const { count: items } = await supabase.from('accounting_entry_items').select('*', { count: 'exact', head: true });
  const { count: txs } = await supabase.from('bank_transactions').select('*', { count: 'exact', head: true });
  
  console.log('   accounting_entries:', entries);
  console.log('   accounting_entry_lines:', lines);
  console.log('   accounting_entry_items:', items);
  console.log('   bank_transactions:', txs);
  
  // 5. Verificar órfãos
  console.log('\n5. Entries Órfãos (sem linhas):');
  const { data: allEntries } = await supabase.from('accounting_entries').select('id');
  const { data: allLines } = await supabase.from('accounting_entry_lines').select('entry_id');
  
  const entryIds = new Set((allEntries || []).map(e => e.id));
  const linkedIds = new Set((allLines || []).map(l => l.entry_id));
  const orphanCount = [...entryIds].filter(id => !linkedIds.has(id)).length;
  
  console.log('   Total:', orphanCount);
  if (orphanCount > 0) {
    console.log('   ❌ EXISTEM ENTRIES ÓRFÃOS - NÃO DESLIGAR MANUTENÇÃO!');
  } else {
    console.log('   ✅ Nenhum órfão encontrado');
  }
  
  // 6. Resumo
  console.log('\n' + '='.repeat(70));
  console.log('RESUMO:');
  console.log('='.repeat(70));
  
  const problems = [];
  if (orphanCount > 0) problems.push(`${orphanCount} entries órfãos`);
  if (integrity?.problems_count > 0) problems.push(`${integrity.problems_count} problemas de integridade`);
  
  if (problems.length === 0) {
    console.log('✅ Sistema SAUDÁVEL - Pode desligar modo manutenção');
  } else {
    console.log('❌ PROBLEMAS ENCONTRADOS:');
    problems.forEach(p => console.log(`   - ${p}`));
    console.log('\n⚠️ NÃO desligar modo manutenção até resolver!');
  }
  
  console.log('\n');
}

check().catch(console.error);
