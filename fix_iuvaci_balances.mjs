
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; // Must be service role to bypass RLS if needed

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixIuvaci() {
  console.log("🛠️  Fixing RESTAURANTE IUVACI Data...\n");

  // 1. Get Client
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%IUVACI%')
    .single();

  if (!clients) {
      console.error("❌ Client IUVACI not found.");
      return;
  }
  const clientId = clients.id;
  console.log(`✅ Client Found: ${clients.name} (${clientId})`);

  const NEW_AMOUNT = 766.88;

  // 2. UPDATE Existing 2024 Records (Jul-Dec + 13th)
  // Fetch them first to get IDs
  const { data: existingBalances } = await supabase
      .from('client_opening_balance')
      .select('id, competence, description, amount')
      .eq('client_id', clientId)
      .like('competence', '%/2024'); // Filter by text 2024

  console.log(`📋 Found ${existingBalances.length} records to update for 2024.`);

  for (const bal of existingBalances) {
      if (bal.amount === NEW_AMOUNT) continue; // Skip if already correct

      console.log(`   📝 Updating ${bal.competence} (${bal.amount} -> ${NEW_AMOUNT})...`);
      
      // A. Update Balance Table
      const { error: errBal } = await supabase
          .from('client_opening_balance')
          .update({ amount: NEW_AMOUNT })
          .eq('id', bal.id);
      
      if (errBal) console.error("Error updating balance:", errBal);

      // B. Update Linked Accounting Entry (Manual ensure consistency since trigger only handles INSERT)
      // Find entry
      const { data: entry } = await supabase
          .from('accounting_entries')
          .select('id')
          .eq('reference_id', bal.id)
          .eq('reference_type', 'client_opening_balance')
          .single();

      if (entry) {
          // Update Entry Totals
          await supabase.from('accounting_entries')
              .update({ total_debit: NEW_AMOUNT, total_credit: NEW_AMOUNT })
              .eq('id', entry.id);

          // Update Lines
          // Debit line
          await supabase.from('accounting_entry_lines')
              .update({ debit: NEW_AMOUNT })
              .eq('entry_id', entry.id)
              .gt('debit', 0); // Update the debit line
              
          // Credit line
          await supabase.from('accounting_entry_lines')
              .update({ credit: NEW_AMOUNT })
              .eq('entry_id', entry.id)
              .gt('credit', 0); // Update the credit line
              
          console.log(`      ✅ Accounting updated for ${bal.competence}`);
      } else {
          console.log(`      ⚠️ No accounting antry found for ${bal.competence} (Trigger should have caught new ones, but these might be old)`);
      }
  }

  // 3. INSERT Missing June 2024
  const MISSING_COMPETENCE = '06/2024';
  
  // Check if exists
  const { data: checkJune } = await supabase
      .from('client_opening_balance')
      .select('id')
      .eq('client_id', clientId)
      .eq('competence', MISSING_COMPETENCE)
      .single();

  if (!checkJune) {
      console.log(`\n➕ Inserting Missing Competence: ${MISSING_COMPETENCE}...`);
      
      const newBalance = {
          client_id: clientId,
          competence: MISSING_COMPETENCE,
          amount: NEW_AMOUNT,
          due_date: '2024-07-10', // Vence 10/07/2024
          description: `Honorários de Junho/2024`,
          status: 'pending',
          paid_amount: 0
      };

      const { data: inserted, error:  errIns } = await supabase
          .from('client_opening_balance')
          .insert(newBalance)
          .select()
          .single();

      if (errIns) {
          console.error("❌ Error inserting June:", errIns);
      } else {
          console.log(`✅ Inserted June 2024 (ID: ${inserted.id})`);
          console.log(`   🛡️  Accounting Trigger should have fired automatically.`);
      }
  } else {
      console.log(`\nℹ️  ${MISSING_COMPETENCE} already exists. checking amount...`);
      // Optional: update if exists but wrong amount
  }

  console.log("\n✨ Fix Complete.");
}

fixIuvaci();
