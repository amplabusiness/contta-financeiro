
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fetchAllRows(startDate, endDate) {
    let allRows = [];
    let from = 0;
    const size = 1000;
    
    while (true) {
        const { data, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            debit, 
            credit,
            chart_of_accounts!inner (
                code, 
                name, 
                level, 
                nature
            ),
            accounting_entries!inner (
                entry_date, 
                entry_type
            )
        `)
        .gte('accounting_entries.entry_date', startDate)
        .lte('accounting_entries.entry_date', endDate)
        .or('code.like.3%,code.like.4%', { foreignTable: 'chart_of_accounts' })
        .range(from, from + size - 1);

        if (error) throw error;
        
        allRows = allRows.concat(data);
        if (data.length < size) break;
        from += size;
    }
    return allRows;
}

async function testServiceQuery() {
  const startDate = '2025-01-01';
  const endDate = '2026-01-31';

  console.log("🧪 Testing Supabase Query Logic (With Pagination)...");

  try {
      const data = await fetchAllRows(startDate, endDate);
      console.log(`✅ Query returned ${data.length} rows (Total).`);
      
      // Aggregate
      let revenue = 0;
      let expenses = 0;
  
      data.forEach(row => {
          const ca = row.chart_of_accounts;
          const d = Number(row.debit);
          const c = Number(row.credit);
          
          let val = 0;
          if (ca.code.startsWith('3')) {
              val = c - d;
              revenue += val;
          } 
          else if (ca.code.startsWith('4')) {
              val = d - c;
              expenses += val;
          }
      });
    
      const simpleNet = data.reduce((acc, row) => acc + Number(row.credit) - Number(row.debit), 0);
    
      console.log(`Revenue (calc):  ${revenue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
      console.log(`Expenses (calc): ${expenses.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
      console.log(`Net via Sum:     ${simpleNet.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
      console.log(`Net via Parts:   ${(revenue - expenses).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);

      // Breakdown Expenses
      const expBreakdown = {};
      data.forEach(row => {
          if (row.chart_of_accounts.code.startsWith('4')) {
              const code = row.chart_of_accounts.code;
              const name = row.chart_of_accounts.name;
              const val = Number(row.debit) - Number(row.credit);
              if (!expBreakdown[code]) expBreakdown[code] = { name, val: 0 };
              expBreakdown[code].val += val;
          }
      });
      
      console.log("\n📉 Top 10 Expense Accounts:");
      Object.entries(expBreakdown)
          .sort(([,a], [,b]) => b.val - a.val)
          .slice(0, 10)
          .forEach(([code, item]) => {
              console.log(`${code.padEnd(15)} | ${item.name.substring(0,40).padEnd(40)} | ${item.val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
          });

  } catch (err) {
      console.error(err);
  }
}

testServiceQuery();
