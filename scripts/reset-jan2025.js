
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_service_role || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetMatching() {
  console.log("Starting Reset Process for Jan 2025...");

  // 1. Open the accounting period (Try both tables to be safe)
  console.log("Step 1: Unlocking Accounting Period (Jan 2025)...");
  
  // Update accounting_periods
  console.log("- Checking 'accounting_periods' table...");
  const { data: periodData, error: periodError } = await supabase
    .from('accounting_periods')
    .update({ status: 'open', closed_at: null })
    .eq('year', 2025)
    .eq('month', 1)
    .select();

  if (periodError) console.error("Failed to unlock accounting_periods:", periodError);
  else if (periodData.length === 0) {
      console.log("No record in 'accounting_periods'. Creating one...");
      await supabase.from('accounting_periods').insert({ year: 2025, month: 1, status: 'open' });
  } else {
      console.log("Unlocked 'accounting_periods'.");
  }

  // Update monthly_closings
  console.log("- Checking 'monthly_closings' table...");
  const { data: closingData, error: closingError } = await supabase
    .from('monthly_closings')
    .update({ status: 'open', closed_at: null })
    .eq('year', 2025)
    .eq('month', 1)
    .select();

  if (closingError) {
      // It might be that the table doesn't exist if the migration wasn't run? 
      // But the trigger exists, so the table must exist.
      console.error("Failed to unlock monthly_closings:", closingError);
  } else if (closingData.length === 0) {
      // If no row exists, it defaults to open (is_period_closed returns false if row is missing)
      console.log("No record in 'monthly_closings'. Ensuring it stays that way or creating open record.");
      // We don't strictly need to insert if the function returns false for NULL, but let's be explicit
      await supabase.from('monthly_closings').insert({ year: 2025, month: 1, status: 'open' });
  } else {
      console.log("Unlocked 'monthly_closings'.");
  }


  // 2. Clear related accounting entries
  console.log("Step 2: Finding linked journal entries...");

  const startJan = '2025-01-01';
  const endJan = '2025-01-31';

  const { data: transactions, error: txError } = await supabase
    .from('bank_transactions')
    .select('id, journal_entry_id')
    .gte('transaction_date', startJan)
    .lte('transaction_date', endJan);

  if (txError) {
      console.error("Error fetching tx:", txError);
      return;
  }

  const journalIds = transactions
    .map(t => t.journal_entry_id)
    .filter(id => id); // Remove nulls

  console.log(`Found ${transactions.length} transactions total.`);
  console.log(`Found ${journalIds.length} linked accounting entries to delete.`);

  if (journalIds.length > 0) {
      console.log("Deleting linked accounting entries...");
      const { error: delError } = await supabase
        .from('accounting_entries')
        .delete()
        .in('id', journalIds);
      
      if (delError) console.error("Error deleting entries:", delError);
      else console.log("Accounting entries deleted.");
  }

  // 3. Reset bank transactions
  console.log("Step 3: Resetting 'matched' status...");
  const { error: updateError } = await supabase
    .from('bank_transactions')
    .update({ matched: false, journal_entry_id: null })
    .gte('transaction_date', startJan)
    .lte('transaction_date', endJan);

  if (updateError) {
    console.error("Error resetting transactions:", updateError);
  } else {
    console.log("SUCCESS! Jan 2025 transactions are now PENDING and unlocked.");
  }
}

resetMatching();
