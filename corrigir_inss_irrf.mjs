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

console.log('🔍 Analisando lançamentos de INSS e IRRF...\n');

try {
  // 1. Verificar contas de INSS e IRRF na chart_of_accounts
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .ilike('name', '%inss%|%irrf%')
    .eq('active', true);

  console.log('📊 Contas encontradas para INSS/IRRF:');
  accounts?.forEach(acc => {
    console.log(`   ${acc.code} - ${acc.name} (${acc.account_type})`);
  });

  // 2. Verificar despesas registradas como INSS/IRRF
  const { data: inssExpenses } = await supabase
    .from('expenses')
    .select('*')
    .ilike('description', '%inss%|%irrf%');

  console.log(`\n💰 Despesas registradas como INSS/IRRF: ${inssExpenses?.length || 0}`);
  if (inssExpenses?.length) {
    inssExpenses.slice(0, 5).forEach(exp => {
      console.log(`   Data: ${exp.date}, Desc: ${exp.description}, Valor: R$ ${exp.amount}`);
    });
  }

  // 3. Verificar lançamentos contábeis relacionados
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select(`
      *,
      lines:accounting_entry_lines(*)
    `)
    .ilike('description', '%inss%|%irrf%')
    .limit(5);

  console.log(`\n📝 Lançamentos contábeis relacionados: ${entries?.length || 0}`);
  entries?.forEach(entry => {
    console.log(`   ${entry.entry_date} - ${entry.description}`);
    entry.lines?.forEach(line => {
      console.log(`      ${line.account_code}: ${line.account_name} (${line.debit || 0} D / ${line.credit || 0} C)`);
    });
  });

  // 4. Verificar categoria de despesas INSS/IRRF
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('*')
    .ilike('name', '%inss%|%irrf%');

  console.log(`\n🏷️ Categorias de despesa encontradas: ${categories?.length || 0}`);
  categories?.forEach(cat => {
    console.log(`   ${cat.id} - ${cat.name}`);
  });

  console.log('\n✅ Análise concluída!');

} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
