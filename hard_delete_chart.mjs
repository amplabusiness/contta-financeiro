
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

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function hardDeleteUnusedAccounts() {
  console.log("🧨 Running HARD DELETE on Unused/Duplicate Accounts...\n");

  // 1. Get Safe List (Used Accounts in Lines)
  const { data: lines, error: linesError } = await supabase
    .from('accounting_entry_lines')
    .select('account_id');

  if (linesError) { console.error("Error fetching usage:", linesError); return; }
  
  const safeIds = new Set(lines.map(l => l.account_id));
  console.log(`🛡️  Used Accounts (Safe): ${safeIds.size}`);

  // 2. Also check if referenced by Bank Accounts? (Optional, but safe)
  // If a bank_account row links to a chart_account, we shouldn't delete that chart_account presumably.
  // But typically the FK is usually from lines to accounts. Let's assume lines are the main blocker.
  // We'll trust the database FKs to throw an error if we miss something.

  // 3. Fetch All Accounts (Active or Inactive)
  const { data: accountsRaw, error: accError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, parent_id');

  if (accError) { console.error("Error fetching accounts:", accError); return; }

  // 4. Filter Candidates: 
  //    - Must Match Pattern A (Old: 1.1.01, 2.1.01) -> Regex /^\d+\.\d+\.0\d/
  //    - OR Must be marked (OBSOLETO) from previous run
  //    - MUST NOT be in Safe List
  
  const regexPatternA = /^\d+\.\d+\.0\d/; 
  
  let candidates = accountsRaw.filter(acc => {
    if (safeIds.has(acc.id)) return false; // In use by transaction

    const isPatternA = regexPatternA.test(acc.code);
    const isObsolete = acc.name.includes('(OBSOLETO)');

    return isPatternA || isObsolete;
  });

  // 5. SORT BY DEPTH DESCENDING
  // We must delete children (level 4) before parents (level 3).
  // The easiest proxy for depth is the Code Length or dots count.
  candidates.sort((a, b) => b.code.length - a.code.length);

  console.log(`🎯 Found ${candidates.length} accounts to PERMANENTLY DELETE.`);
  console.log("   (Sorted by depth first to handle dependencies)");

  if (candidates.length === 0) { console.log("Nothing to delete."); return; }

  // 6. Delete Loop
  let deletedCount = 0;
  let skippedCount = 0;

  // Process in serial to respect parent-child if we sorted right, or batch?
  // Serial is safer for FK errors.
  for (const acc of candidates) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('id', acc.id);

      if (error) {
          console.error(`   ❌ Failed to delete [${acc.code}] ${acc.name}: ${error.details || error.message}`);
          skippedCount++;
      } else {
          // console.log(`   Deleted [${acc.code}]`);
          deletedCount++;
      }
      
      // Progress ticker
      if (deletedCount % 20 === 0 && deletedCount > 0) process.stdout.write('.');
  }

  console.log(`\n\n✅ Result: ${deletedCount} Deleted, ${skippedCount} Skipped (likely constraints).`);
}

hardDeleteUnusedAccounts();
