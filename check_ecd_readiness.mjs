
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

async function checkECDCompliance() {
  console.log("🔍 Checking SPED ECD Readiness...\n");

  // 1. Check Table Structure for 'chart_of_accounts' to see if 'referential_code' or similar exists
  // We can't query schema directly easily without SQL, so we'll fetch one row and inspect keys.
  const { data: accounts, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching accounts:", error);
    return;
  }

  if (accounts.length > 0) {
    const keys = Object.keys(accounts[0]);
    console.log("📂 Chart of Accounts Columns:", keys.join(', '));
    
    // Check key fields for SPED
    const hasNature = keys.some(k => k.includes('nature') || k.includes('type'));
    const hasReferential = keys.some(k => k.includes('ref') || k.includes('ecd') || k.includes('sped'));
    
    console.log(`- Account Type/Nature (Asset, Liability, etc): ${hasNature ? '✅ Found' : '❌ MISSING (Required for I050)'}`);
    console.log(`- Referential Code (Plano Referencial Receita): ${hasReferential ? '✅ Found' : '❌ MISSING (Required for I051)'}`);
  }

  // 2. Check for 'cost_center' if it's used
  // SPED I100 requires Cost Center if the company uses it.
  const { data: entries } = await supabase.from('accounting_entry_lines').select('*').limit(1);
    if (entries && entries.length > 0) {
        const entryKeys = Object.keys(entries[0]);
        console.log("📂 Entry Lines Columns:", entryKeys.join(', '));
        const hasCostCenter = entryKeys.includes('cost_center_id');
        console.log(`- Cost Center: ${hasCostCenter ? '✅ Found' : '⚠️ Not found (Optional if not used)'}`);
    }

}

checkECDCompliance();
