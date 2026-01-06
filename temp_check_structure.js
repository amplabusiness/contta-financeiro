import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xdtlhzysrpoinqtsglmr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMjc0NDksImV4cCI6MjA3ODcwMzQ0OX0.LxbKNn2cXq-Hi8cilyQyQsPj2jbC8DPMNuxtC5h75Es'
);

async function checkEntries() {
  // Buscar resumo de despesas por conta
  const { data: summary, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit,
      chart_of_accounts!inner (
        code,
        name
      ),
      accounting_entries!inner (
        entry_date,
        entry_type
      )
    `)
    .gt('debit', 0)
    .like('chart_of_accounts.code', '4.%')
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  if (error) {
    console.error('Erro:', error);
    return;
  }

  // Agrupar por conta
  const groups = {};
  let totalGeral = 0;

  summary.forEach(s => {
    const code = s.chart_of_accounts.code;
    const name = s.chart_of_accounts.name;
    const key = code + ' - ' + name;

    if (!groups[key]) {
      groups[key] = { count: 0, total: 0 };
    }
    groups[key].count++;
    groups[key].total += s.debit;
    totalGeral += s.debit;
  });

  console.log('=== RESUMO DAS DESPESAS DE JANEIRO/2025 ===\n');

  Object.keys(groups).sort().forEach(key => {
    const g = groups[key];
    const pct = ((g.total / totalGeral) * 100).toFixed(1);
    console.log(key);
    console.log('  Qtd: ' + g.count + ' | Total: R$ ' + g.total.toFixed(2) + ' (' + pct + '%)');
    console.log('');
  });

  console.log('=== TOTAL GERAL: R$ ' + totalGeral.toFixed(2) + ' ===');
}

checkEntries();
