
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBreakdown() {
  console.log("🔍 Checking Balance Breakdown for Account 1.1.2.01 (Clients)...\n");

  // 1. Get Account ID
  const { data: accountData, error: accountError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01')
    .single();

  if (accountError) {
    console.error("Error finding account 1.1.2.01:", accountError);
    return;
  }
  
  const accountId = accountData.id;
  console.log(`✅ Found Account: ${accountData.name} (${accountData.code}) ID: ${accountId}`);

  // 2. Get Lines
  const { data, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit,
      credit,
      description,
      accounting_entries!inner (
        entry_type,
        entry_date,
        description
      )
    `)
    .eq('account_id', accountId);

  if (error) {
    console.error("Error fetching lines:", error);
    return;
  }

  // Aggregate by Entry Type
  const summary = {};
  let totalDebit = 0;
  let totalCredit = 0;

  data.forEach(line => {
    const type = line.accounting_entries.entry_type || 'UNKNOWN';
    if (!summary[type]) {
      summary[type] = { count: 0, debit: 0, credit: 0, net: 0, sample_desc: '' };
    }
    
    summary[type].count++;
    
    const d = Number(line.debit) || 0;
    const c = Number(line.credit) || 0;
    
    summary[type].debit += d;
    summary[type].credit += c;
    totalDebit += d;
    totalCredit += c;

    if (!summary[type].sample_desc) {
      summary[type].sample_desc = line.accounting_entries.description?.substring(0, 30);
    }
  });

  // Calc Net for each
  Object.keys(summary).forEach(k => {
    summary[k].net = summary[k].debit - summary[k].credit;
  });

  console.log("📊 Breakdown by Entry Type:");
  console.table(summary);

  console.log("\n📉 TOTALS:");
  console.log(`Total Debits (Invoices/Op.Bal): ${totalDebit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
  console.log(`Total Credits (Payments):       ${totalCredit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
  console.log(`NET BALANCE:                    ${(totalDebit - totalCredit).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
}

checkBreakdown();
