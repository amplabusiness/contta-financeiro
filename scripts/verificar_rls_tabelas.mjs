// Script para verificar RLS nas tabelas principais
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const TABELAS_PRINCIPAIS = [
  'clients',
  'invoices',
  'expenses',
  'bank_transactions',
  'bank_accounts',
  'accounting_entries',
  'accounting_entry_items',
  'chart_of_accounts',
  'client_opening_balance',
  'client_ledger',
  'rubricas',
  'suppliers',
  'employee_salaries',
  'cost_centers'
];

async function verificar() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICAÇÃO DE RLS MULTI-ESCRITÓRIO                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  console.log('Verificando estrutura das tabelas...\n');

  for (const tabela of TABELAS_PRINCIPAIS) {
    // Verificar colunas da tabela
    const { data: sample, error } = await supabase
      .from(tabela)
      .select('*')
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      // Tabela vazia
      const { data: cols } = await supabase
        .from(tabela)
        .select('*')
        .limit(0);

      console.log(`📋 ${tabela}:`);
      console.log('   (tabela vazia, não foi possível verificar colunas)\n');
    } else if (error) {
      console.log(`❌ ${tabela}: Erro - ${error.message}\n`);
    } else if (sample) {
      const temOfficeId = 'office_id' in sample;
      const temTenantId = 'tenant_id' in sample;
      const status = temOfficeId || temTenantId ? '✅' : '⚠️';

      console.log(`${status} ${tabela}:`);
      console.log(`   office_id: ${temOfficeId ? 'SIM' : 'NÃO'}`);
      console.log(`   tenant_id: ${temTenantId ? 'SIM' : 'NÃO'}`);

      if (temTenantId) {
        console.log(`   tenant_id valor: ${sample.tenant_id || 'NULL'}`);
      }
      if (temOfficeId) {
        console.log(`   office_id valor: ${sample.office_id || 'NULL'}`);
      }
      console.log('');
    }
  }

  // Verificar tabela tenants
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('VERIFICANDO TENANTS:');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name, slug, status');

  if (tenantsError) {
    console.log(`❌ Erro: ${tenantsError.message}`);
  } else if (tenants && tenants.length > 0) {
    console.log(`✅ ${tenants.length} tenant(s) encontrado(s):`);
    for (const t of tenants) {
      console.log(`   - ${t.name} (${t.slug}) [${t.status}] ID: ${t.id}`);
    }
  } else {
    console.log('⚠️ Nenhum tenant encontrado. Precisa criar o tenant da AMPLA.');
  }
}

verificar().catch(console.error);
