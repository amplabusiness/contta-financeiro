
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix13thSalary() {
  console.log("🛠️  Fixing 13th Salary Duplicates (12/2024 -> 13/2024)...\n");

  // 1. Fetch all 12/2024 balances
  const { data: balances, error } = await supabase
    .from('client_opening_balance')
    .select(`
      id, 
      client_id, 
      amount, 
      competence, 
      description,
      clients (name)
    `)
    .eq('competence', '12/2024');

  if (error) {
    console.error("Error fetching balances:", error);
    return;
  }

  // 2. Group by client
  const clientGroups = {};
  balances.forEach(b => {
    if (!clientGroups[b.client_id]) clientGroups[b.client_id] = [];
    clientGroups[b.client_id].push(b);
  });

  // 3. Process duplicates
  let fixedCount = 0;

  for (const clientId in clientGroups) {
    const items = clientGroups[clientId];
    
    // Only interested if there are exactly 2 entries (duplicates)
    // If there are more, we might need manual check, but usually it's 2.
    if (items.length >= 2) {
      const clientName = items[0].clients?.name || 'Unknown';
      console.log(`\n👥 Found duplicates for ${clientName}: ${items.length} records.`);

      // Sort by ID (assume the second one inserted is the 13th? Or just arbitrary)
      // Usually 13th is generated after.
      items.sort((a, b) => a.id.localeCompare(b.id));

      // The second one (index 1) will be the 13th
      const itemToFix = items[1]; 
      
      console.log(`   👉 Converting ID ${itemToFix.id} to 13th Salary...`);

      // A. Update Balance
      const { error: errBal } = await supabase
        .from('client_opening_balance')
        .update({
          competence: '13/2024',
          description: 'Honorários 13º Salário 2024',
          due_date: '2024-12-20'
        })
        .eq('id', itemToFix.id);

      if (errBal) {
        console.error("   ❌ Error updating balance:", errBal);
        continue;
      }

      // B. Update Linked Accounting Entry
      // Find entry by reference
      const { data: entry } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('reference_id', itemToFix.id)
        .eq('reference_type', 'client_opening_balance')
        .maybeSingle();

      if (entry) {
        const { error: errEntry } = await supabase
          .from('accounting_entries')
          .update({
            description: `Saldo Abertura 13º - ${clientName}`,
            entry_date: '2024-12-20'
            // Keep competence_date as is (probably 2024-12-01) or change to 2024-12-31? 
            // Postgres date "2024-13-01" is invalid.
            // Leaving competence_date in Dec is fine for accounting period.
          })
          .eq('id', entry.id);

        if (errEntry) console.error("   ❌ Error updating entry:", errEntry);
        else console.log("   ✅ Accounting Entry updated.");
      } else {
        console.warn("   ⚠️ No linked accounting entry found.");
      }

      fixedCount++;
    }
  }

  console.log(`\n✨ Finished. Fixed ${fixedCount} records.`);
}

fix13thSalary();
