
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

async function inspect() {
  console.log("🔍 Inspecting Table Structures...\n");

  // 1. Check accounting_entries columns
  const { data: entries, error: err1 } = await supabase
    .from('accounting_entries')
    .select('*')
    .limit(1);
  
  if (err1) console.error("Entries Error:", err1);
  else console.log("Entries keys:", Object.keys(entries[0] || {}));

  // 2. Check accounting_entry_lines columns
  const { data: lines, error: err2 } = await supabase
    .from('accounting_entry_lines')
    .select('*')
    .limit(1);

  if (err2) console.error("Lines Error:", err2);
  else console.log("Lines keys:", Object.keys(lines[0] || {}));

  // 3. Check chart_of_accounts for code 1.1.2.01
  const { data: accounts, error: err3 } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('code', '1.1.2.01');

  if (err3) console.error("Accounts Error:", err3);
  else console.log("Account 1.1.2.01 found:", accounts.length, accounts[0]);
}

inspect();
