
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

async function sanitizeChartJs() {
  console.log("🧹 Running Chart Sanitization (JS Mode via API)...\n");

  // 1. Get Safe List (Used Accounts)
  const { data: lines, error: linesError } = await supabase
    .from('accounting_entry_lines')
    .select('account_id');

  if (linesError) {
    console.error("Error fetching usage:", linesError);
    return;
  }
  const safeIds = new Set(lines.map(l => l.account_id));
  console.log(`🛡️  Found ${safeIds.size} protected accounts (in use).`);

  // 2. Fetch All Active Accounts
  const { data: accounts, error: accError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('is_active', true);

  if (accError) {
    console.error("Error fetching accounts:", accError);
    return;
  }

  // 3. Identify Candidates for Deletion (Pattern A: X.X.0X like 1.1.01)
  const regexPatternA = /^\d+\.\d+\.0\d/; // Matches 1.1.01, 2.1.01 etc.
  
  const candidates = accounts.filter(acc => {
    // Must match regex
    if (!regexPatternA.test(acc.code)) return false;
    // Must NOT be in safe list
    if (safeIds.has(acc.id)) return false;
    // Must NOT already be marked (though we filtered is_active=true)
    if (acc.name.includes('(OBSOLETO)')) return false;
    
    return true;
  });

  console.log(`🎯 Found ${candidates.length} duplicate/obsolete accounts to deactivate.`);
  
  if (candidates.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // 4. Batch Update (Processing in chunks to avoid timeouts)
  const batchSize = 20;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    
    const updatePromises = batch.map(acc => {
      const newName = `${acc.name} (OBSOLETO)`.substring(0, 255);
      return supabase
        .from('chart_of_accounts')
        .update({ is_active: false, name: newName })
        .eq('id', acc.id);
    });

    await Promise.all(updatePromises);
    console.log(`   Processed batch ${i + 1}-${Math.min(i + batchSize, candidates.length)}...`);
  }

  // 5. Cleanup Orphans (Children of deactivated parents)
  // Re-fetch to see updated status
  // Loop until no more orphans found (hierarchy depth)
  
  let orphansFound = true;
  let pass = 1;

  while (orphansFound && pass <= 3) {
      console.log(`\n🧹 Orphan Cleanup Pass ${pass}...`);
      
      // Get IDs of currently inactive/obsolete accounts
      const { data: inactiveAccs } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .or('is_active.eq.false,name.ilike.%(OBSOLETO)%');
        
      const inactiveIds = new Set(inactiveAccs?.map(a => a.id) || []);
      
      if (inactiveIds.size === 0) break;

      // Find active children of inactive parents
      const { data: orphans } = await supabase
        .from('chart_of_accounts')
        .select('id, name, parent_id')
        .eq('is_active', true);
        
      const targets = orphans.filter(o => o.parent_id && inactiveIds.has(o.parent_id) && !safeIds.has(o.id));
      
      if (targets.length > 0) {
          console.log(`   Found ${targets.length} orphans to deactivate.`);
          const batchSizeOrphans = 20;
          for (let i = 0; i < targets.length; i += batchSizeOrphans) {
              const batch = targets.slice(i, i + batchSizeOrphans);
              const orphanPromises = batch.map(acc => {
                const newName = `${acc.name} (OBSOLETO)`.substring(0, 255);
                return supabase
                    .from('chart_of_accounts')
                    .update({ is_active: false, name: newName })
                    .eq('id', acc.id);
              });
              await Promise.all(orphanPromises);
          }
          orphansFound = true;
      } else {
          orphansFound = false;
          console.log("   No more orphans found.");
      }
      pass++;
  }

  console.log("\n✅ Sanitization Complete.");
}

sanitizeChartJs();
