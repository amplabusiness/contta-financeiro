
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .rpc('get_schema_info', { table_name: 'accounting_entry_lines' }); // Try RPC first if exists
    
  // If no RPC, just select one row to see keys
  const { data: rows, error: rowError } = await supabase
    .from('accounting_entry_lines')
    .select('*')
    .limit(1);

  if (rowError) {
    console.error("Error fetching row:", rowError);
  } else {
    console.log("Columns in accounting_entry_lines:");
    if (rows.length > 0) {
      console.log(Object.keys(rows[0]));
    } else {
      console.log("Table empty, but exists.");
    }
  }
}

checkSchema();
