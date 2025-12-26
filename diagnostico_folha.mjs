import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

console.log('🔍 Diagnóstico completo de Folha de Pagamento e INSS/IRRF\n');

try {
  // 1. Verificar contas de SALÁRIOS
  console.log('=== 1. CONTAS DE SALÁRIOS ===');
  const { data: salaryAccounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .ilike('name', '%salar%|%ordenado%')
    .order('code');

  if (salaryAccounts?.length) {
    salaryAccounts.forEach(acc => {
      console.log(`✓ ${acc.code} - ${acc.name} (${acc.account_type})`);
    });
  } else {
    console.log('✗ Nenhuma conta de salários encontrada');
  }

  // 2. Verificar contas de PASSIVO (INSS/IRRF a Recolher)
  console.log('\n=== 2. CONTAS DE PASSIVO (Obrigações) ===');
  const { data: liabilityAccounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('account_type', 'Liability')
    .order('code');

  console.log(`Total de contas de Passivo: ${liabilityAccounts?.length || 0}`);
  liabilityAccounts?.slice(0, 15).forEach(acc => {
    console.log(`  ${acc.code} - ${acc.name}`);
  });

  // 3. Buscar especificamente por retenções/obrigações
  console.log('\n=== 3. CONTAS DE RETENÇÃO ===');
  const { data: retentionAccounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .ilike('name', '%recolher%|%retencao%|%retenção%|%provisionado%')
    .order('code');

  if (retentionAccounts?.length) {
    retentionAccounts.forEach(acc => {
      console.log(`✓ ${acc.code} - ${acc.name} (${acc.account_type})`);
    });
  } else {
    console.log('✗ Nenhuma conta de retenção/obrigação encontrada');
  }

  // 4. Verificar employees e se há payroll
  console.log('\n=== 4. FUNCIONÁRIOS ===');
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .limit(5);

  console.log(`Total de funcionários: ${employees?.length || 0}`);

  // 5. Verificar se existem lançamentos de folha de pagamento
  console.log('\n=== 5. LANÇAMENTOS DE FOLHA DE PAGAMENTO ===');
  const { data: payrollEntries } = await supabase
    .from('accounting_entries')
    .select('*')
    .ilike('description', '%folha%|%payroll%|%pagamento funcionario%')
    .limit(5);

  console.log(`Lançamentos de folha encontrados: ${payrollEntries?.length || 0}`);
  if (payrollEntries?.length) {
    payrollEntries.forEach(entry => {
      console.log(`  ${entry.entry_date} - ${entry.description}`);
    });
  }

  // 6. Verificar category expenses relacionadas a folha
  console.log('\n=== 6. CATEGORIAS DE FOLHA DE PAGAMENTO ===');
  const { data: payrollCategories } = await supabase
    .from('expense_categories')
    .select('*')
    .ilike('name', '%folha%|%salario%|%encargo%')
    .order('name');

  if (payrollCategories?.length) {
    payrollCategories.forEach(cat => {
      console.log(`  ${cat.id} - ${cat.name}`);
    });
  } else {
    console.log('✗ Nenhuma categoria de folha de pagamento');
  }

  console.log('\n✅ Diagnóstico concluído!');

} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
