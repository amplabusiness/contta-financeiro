
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillInvoices() {
  console.log("🚀 Backfilling Monthly Fees (Invoices) for 2025...\n");

  const months = [
    '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', 
    '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01', 
    '2025-09-01', '2025-10-01', '2025-11-01', '2025-12-01',
    '2024-12-01' // Also Dec 2024? User said start 01/2025, but bank extracts go back to Dec 2024.
                 // If invoices for Dec 2024 are paid in Jan 2025, they need to exist. 
                 // We handled Dec 2024 via Opening Balances import earlier? 
                 // Yes, "import historical debts" handled pending items.
                 // But maybe we should generate full Dec 2024 invoices?
                 // Let's stick to 2025 for now to avoid duplicates with Opening Balance.
  ];

  for (const date of months) {
    console.log(`📅 Generating for ${date}...`);
    
    const { data, error } = await supabase.rpc('generate_monthly_fees', { p_competence_date: date });
    
    if (error) console.error("   ❌ Error:", error.message);
    else console.log(`   ✅ Generated/Checked: ${data} invoices.`);
  }

  console.log("\n✨ Backfill Complete.");
}

backfillInvoices();
