
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

async function listUsedAccounts() {
  console.log("🔍 Identifying USED accounts to determine the 'Winning' Pattern...\n");

  // Get Distinct Account IDs from Lines
  const { data: lines, error } = await supabase
    .from('accounting_entry_lines')
    .select('account_id');

  if (error) { console.error(error); return; }

  const usedIds = [...new Set(lines.map(l => l.account_id))];

  // Get details for these accounts
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('code, name, id')
    .in('id', usedIds)
    .order('code');

  console.log("✅ The following accounts have DATA (Must be preserved):");
  accounts.forEach(a => console.log(`   - [${a.code}] ${a.name}`));

  // Heuristic for pattern
  const patternA = accounts.filter(a => a.code.match(/^\d\.\d\.\d{2}/)).length; // 1.1.01...
  const patternB = accounts.filter(a => a.code.match(/^\d\.\d\.\d{1}\./) || a.code.match(/^\d\.\d\.\d{1}$/)).length; // 1.1.1...

  console.log(`\n📊 Validated Usage Pattern:`);
  console.log(`   - Pattern A (e.g., 1.1.01): ${patternA} accounts`);
  console.log(`   - Pattern B (e.g., 1.1.1):  ${patternB} accounts`);
}

listUsedAccounts();
