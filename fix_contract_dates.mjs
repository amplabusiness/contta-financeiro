
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

async function fixContractDates() {
  console.log("🛠️  Fixing Contract Dates (moving 2025-12-19 to 2024-01-01)...\n");

  const { data: contracts, error } = await supabase
    .from('accounting_contracts')
    .update({ start_date: '2024-01-01' }) // Move back to cover 2024/2025 history
    .eq('start_date', '2025-12-19') // Target the specific import artifact
    .select('id, client_id');

  if (error) console.error("❌ Error updating:", error.message);
  else console.log(`✅ Updated ${contracts.length} contracts to start date 2024-01-01.`);
}

fixContractDates();
