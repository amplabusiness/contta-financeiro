
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Ensure .env has VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLivroDiario() {
  console.log("🔍 Verifying 'Livro Diário' Logic Data Source...\n");

  // 1. Fetch data using the EXACT logic from LivroDiario.tsx (with service role key to see all)
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      description,
      accounting_entry_lines (
        id,
        debit,
        credit,
        account_id,
        chart_of_accounts (
          code,
          name
        )
      )
    `)
    .limit(500); // Check sample

  if (error) {
    console.error("❌ Error fetching accounting_entries:", error);
    return;
  }

  console.log(`✅ Fetched ${entries.length} entries via correct relations.\n`);

  let inconsistentEntries = 0;
  let missingAccountCodes = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of entries) {
    const lines = entry.accounting_entry_lines || [];
    
    // Check Partidas Dobradas (Debits == Credits) per entry
    const entryDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const entryCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    
    totalDebit += entryDebit;
    totalCredit += entryCredit;

    if (Math.abs(entryDebit - entryCredit) > 0.01) {
      console.warn(`⚠️ Inconsistent Entry ID ${entry.id}: Debit ${entryDebit.toFixed(2)} != Credit ${entryCredit.toFixed(2)}`);
      inconsistentEntries++;
    }

    // Check consistency with Chart of Accounts
    for (const line of lines) {
      if (!line.chart_of_accounts) {
        console.warn(`⚠️ Line ID ${line.id} in Entry ${entry.id} has NO chart_of_accounts link.`);
        missingAccountCodes++;
      }
    }
  }

  console.log("\n📊 Summary:");
  console.log(`- Total Entries Checked: ${entries.length}`);
  console.log(`- Inconsistent Entries (D!=C): ${inconsistentEntries}`);
  console.log(`- Lines missing Account Code (Source of Truth): ${missingAccountCodes}`);
  console.log(`- Total Debit: ${totalDebit.toFixed(2)}`);
  console.log(`- Total Credit: ${totalCredit.toFixed(2)}`);

  if (Math.abs(totalDebit - totalCredit) < 0.01) {
    console.log("\n✅ GLOBAL INTEGRITY: Total Debits match Total Credits.");
  } else {
    console.error("\n❌ GLOBAL INTEGRITY: Debits do NOT match Credits.");
  }

  if (missingAccountCodes === 0) {
      console.log("✅ DATA SOURCE: All lines are correctly linked to 'chart_of_accounts' (Source of Truth).");
  } else {
      console.error("❌ DATA SOURCE: Some lines are disconnected from the Chart of Accounts.");
  }
}

verifyLivroDiario();
