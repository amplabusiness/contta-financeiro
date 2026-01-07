
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkChartSchema() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .limit(1);

  if (error) { console.error(error); return; }
  console.log(Object.keys(data[0]));
}

checkChartSchema();
