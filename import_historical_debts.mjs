
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importHistoricalDebts() {
  console.log("🚀 Starting Import of Historical Debts (Pre-2025)...\n");

  // 1. Read JSON file
  const jsonPath = path.join(__dirname, 'honorarios_temp.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("❌ honorarios_temp.json not found!");
    return;
  }
  
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  let debts = JSON.parse(rawData);
  
  // 2. Filter for 2024 (or earlier?)
  // User said: "extrato de janeiro 2025 tem pagamentos de dez 2024 para traz"
  // So we import everything with due_date < 2025-01-01
  
  const historicalDebts = debts.filter(d => {
    // Check year in competence or due_date
    const is2024 = d.competence.includes('/2024') || d.due_date.startsWith('2024');
    return is2024;
  });

  console.log(`📂 Loaded ${debts.length} total records from JSON.`);
  console.log(`📉 Found ${historicalDebts.length} historical records (2024) to import.`);
  
  if (historicalDebts.length === 0) {
    console.log("No historical debts found to import.");
    return;
  }

  // 3. Import loop
  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const debt of historicalDebts) {
    const { client_id, competence, amount, due_date, clients } = debt;
    const clientName = clients?.name || "Unknown Client";

    // Check if exists
    const { data: existing } = await supabase
      .from('client_opening_balance')
      .select('id')
      .eq('client_id', client_id)
      .eq('competence', competence)
      .maybeSingle();

    if (existing) {
      // console.log(`   ⚠️ Skipped (Exists): ${clientName} - ${competence}`);
      skippedCount++;
      continue;
    }

    // Insert
    const newRecord = {
      client_id: client_id,
      competence: competence,
      amount: amount,
      due_date: due_date,
      description: `Honorários ${competence}`, // Standardize description
      status: 'pending',
      paid_amount: 0
    };

    const { error } = await supabase
      .from('client_opening_balance')
      .insert(newRecord);

    if (error) {
      console.error(`   ❌ Error inserting ${clientName} (${competence}):`, error.message);
      errorCount++;
    } else {
      console.log(`   ✅ Imported: ${clientName} - ${competence} (R$ ${amount})`);
      insertedCount++;
    }
  }

  console.log("\n📊 Import Summary:");
  console.log(`   - Total Processed: ${historicalDebts.length}`);
  console.log(`   - Inserted: ${insertedCount}`);
  console.log(`   - Skipped (Already Exists): ${skippedCount}`);
  console.log(`   - Errors: ${errorCount}`);
  
  console.log("\n🛡️  Note: Triggers should have automatically created accounting entries for all inserted records.");
}

importHistoricalDebts();
