
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

async function analyzeChartIntegrity() {
  console.log("🔍 Analyzing Chart of Accounts Integrity...\n");

  // 1. Fetch All Accounts
  const { data: accounts, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_analytical')
    .order('code');

  if (error) {
    console.error("Error:", error);
    return;
  }

  // 2. Analyze Structural Duplication (Mixed Masks)
  // Common masks: X.X.X.XX or X.X.XX.XX or X.X.X.X
  
  const maskGroups = {};
  
  accounts.forEach(acc => {
    // Determine depth based on dots
    const depth = acc.code.split('.').length;
    // Determine pattern (e.g. 1.1.1 vs 1.1.01)
    // Heuristic: check length of 3rd segment
    const parts = acc.code.split('.');
    let pattern = 'Unknown';
    if (parts.length >= 3) {
      pattern = `Level 3 Length: ${parts[2].length}`; // '1' or '01'
    } else {
      pattern = `Root/Group`;
    }

    if (!maskGroups[pattern]) maskGroups[pattern] = [];
    maskGroups[pattern].push(acc);
  });

  console.log("📊 Structure Analysis (Mask Consistency):");
  Object.keys(maskGroups).forEach(k => {
    console.log(`   - Pattern [${k}]: ${maskGroups[k].length} accounts.`);
    // Sample
    const sample = maskGroups[k].slice(0, 3).map(a => `${a.code} ${a.name}`).join(', ');
    console.log(`     Ex: ${sample}`);
  });

  // 3. Check usage (Balances) to see which structure is "Alive"
  console.log("\n💰 Checking Usage Activity (Balances)...");
  
  // We need to see which accounts have ENTRIES
  const { data: activeLineStats, error: statError } = await supabase.rpc('debug_get_account_usage_stats'); 
  // If RPC doesn't exist, we do manual check
  let activeAccountIds = new Set();
  
  if (statError) {
      // Fallback: Fetch distinct account_ids from lines
      const { data: lines } = await supabase.from('accounting_entry_lines').select('account_id');
      lines.forEach(l => activeAccountIds.add(l.account_id));
  } else {
      // Logic if RPC existed, but assuming fallback for now as I don't know if RPC exists
  }

  // Fallback implementation since I can't be sure RPC exists
  const { data: lines } = await supabase.from('accounting_entry_lines').select('account_id');
  lines?.forEach(l => activeAccountIds.add(l.account_id));

  console.log(`   - Found ${activeAccountIds.size} accounts with actual transactions.`);

  // 4. Identify Duplicates
  console.log("\n⚠️ Potential Duplicates (Same Name, Different Code):");
  const nameMap = {};
  accounts.forEach(acc => {
      const normalized = acc.name.trim().toUpperCase();
      if (!nameMap[normalized]) nameMap[normalized] = [];
      nameMap[normalized].push(acc);
  });

  Object.keys(nameMap).forEach(name => {
      if (nameMap[name].length > 1) {
          const codes = nameMap[name].map(a => {
              const isActive = activeAccountIds.has(a.id) ? ' (USED)' : ' (EMPTY)';
              return `[${a.code}]${isActive}`;
          }).join(', ');
          
          // Filter out trivial ones like "OUTROS" unless relevant
          if (name !== 'OUTROS' && name !== 'DIVERSOS') {
             console.log(`   - "${name}": ${codes}`);
          }
      }
  });

}

analyzeChartIntegrity();
