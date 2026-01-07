
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

async function auditAccounting() {
  console.log("🔍 AUDIT: Verifying Accounting Entries for Client Opening Balances...\n");

  // 1. Get Account ID for 1.1.2.01
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();
  
  const accountId = accounts?.id;
  if (!accountId) {
    console.error("❌ Account 1.1.2.01 not found!");
    return;
  }
  console.log(`✅ Account 1.1.2.01 ID: ${accountId}`);

  // 2. Fetch Client Opening Balances (Pre-2025)
  const { data: balances, error: balError } = await supabase
    .from('client_opening_balance')
    .select(`
      id,
      client_id,
      amount,
      competence,
      description,
      clients (name)
    `)
    .eq('status', 'pending');

  if (balError) {
    console.error("Error fetching balances:", balError);
    return;
  }

  // Filter < 2025 like before
  const parseCompetence = (compStr) => {
      if (!compStr) return null;
      if (compStr.includes('/')) {
          const [month, year] = compStr.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, 1);
      }
      if (compStr.includes('-')) {
          const [year, month] = compStr.split('-');
          return new Date(parseInt(year), parseInt(month) - 1, 1);
      }
      return null;
  };
  const CUTOFF_DATE = new Date(2025, 0, 1);
  const targetBalances = balances.filter(b => {
      const date = parseCompetence(b.competence);
      return date && date < CUTOFF_DATE;
  });

  console.log(`📋 Found ${targetBalances.length} target opening balances to check.`);

  // 3. Check Accounting Entries
  // We look for entries linked by reference_id, or by matching amount and description
  
  let matchCount = 0;
  let missingCount = 0;

  for (const bal of targetBalances) {
    const clientName = bal.clients?.name || 'Unknown';
    
    // Attempt 1: Check by direct reference
    let { data: entriesRef } = await supabase
      .from('accounting_entries')
      .select('id, entry_date, description')
      .eq('reference_id', bal.id)
      .eq('reference_type', 'client_opening_balance'); // Assuming this type
      
    // Attempt 2: If no reference, check by Amount/Description fuzzy match in Lines
    if (!entriesRef || entriesRef.length === 0) {
        // Find lines with this amount within reasonable date range?
        // Actually, opening balance entries usually have same amount.
        // Let's search lines with specific amount AND account_id
        
        const { data: lines } = await supabase
            .from('accounting_entry_lines')
            .select('entry_id, debit, credit, accounting_entries(description, entry_date)')
            .eq('account_id', accountId)
            .eq('debit', bal.amount); // Debit to Asset
            
        // Filter lines that might match based on description or date
        // Opening balances usually dated 2024-12-31 or 2025-01-01
        if (lines && lines.length > 0) {
             const possible = lines.find(l => {
                 const desc = l.accounting_entries?.description || '';
                 return desc.includes(clientName) || desc.includes('Saldo Abertura');
             });
             if (possible) {
                 entriesRef = [possible.accounting_entries];
             }
        }
    }

    if (entriesRef && entriesRef.length > 0) {
       // console.log(`✅ [MATCH] ${clientName} - R$ ${bal.amount} -> Entry ID: ${entriesRef[0].id}`);
       matchCount++;
    } else {
       console.log(`❌ [MISSING] ${clientName} - R$ ${bal.amount} (${bal.competence}) - Description: ${bal.description}`);
       missingCount++;
    }
  }

  console.log("\n📊 SUMMARY:");
  console.log(`✅ Matched Entries: ${matchCount}`);
  console.log(`❌ Missing Entries: ${missingCount}`);
  
  if (missingCount > 0) {
      console.log("\n⚠️  Action Required: Generate Journal Entries for the missing balances.");
  } else {
      console.log("\n✨ All balances have corresponding accounting entries.");
  }
}

auditAccounting();
