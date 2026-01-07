
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function generateDRE() {
  console.log("📊 Gerando Prévia do DRE (Baseado no Livro Razão)...\n");

  // Fetch all lines joined with accounts
  const { data, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit,
      credit,
      chart_of_accounts!inner (
        code,
        name,
        type
      )
    `);

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  const dre = {
    revenue: 0,
    taxes: 0, // 3.2 or 4.x depending on plan? Usually taxes on revenue are deductions
    costs: 0,
    expenses: 0,
    financial: 0
  };

  const breakdown = {};

  data.forEach(line => {
    const code = line.chart_of_accounts.code;
    const name = line.chart_of_accounts.name;
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    
    // Group 3: RECEITAS (Credora -> Credit increases result)
    if (code.startsWith('3')) {
      const val = credit - debit;
      dre.revenue += val;
      
      // Store breakdown
      if (!breakdown[code]) breakdown[code] = { name, val: 0 };
      breakdown[code].val += val;
    }
    
    // Group 4: DESPESAS (Devedora -> Debit increases expense)
    if (code.startsWith('4')) {
      const val = debit - credit;
      dre.expenses += val;
      
      if (!breakdown[code]) breakdown[code] = { name, val: 0 };
      breakdown[code].val += val;
    }
  });

  console.log("📑 DETALHAMENTO:");
  const sortedKeys = Object.keys(breakdown).sort();
  sortedKeys.forEach(k => {
    // Only show significant values
    if (Math.abs(breakdown[k].val) > 0.01) {
        console.log(`${k.padEnd(15)} | ${breakdown[k].name.padEnd(40)} | ${breakdown[k].val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
    }
  });

  console.log("\n=============================================");
  console.log("💰 DRE RESUMIDO (JANEIRO/2026)");
  console.log("=============================================");
  console.log(`(+) RECEITA BRUTA:    ${dre.revenue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
  console.log(`(-) DESPESAS/CUSTOS:  ${dre.expenses.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
  console.log("---------------------------------------------");
  const result = dre.revenue - dre.expenses;
  console.log(`(=) RESULTADO LIQ:    ${result.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
  console.log("=============================================\n");
}

generateDRE();
