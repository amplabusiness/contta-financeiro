
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkChartValues() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('code, name, nature, type, level')
    .or('code.eq.3.1.01.001,code.eq.4.1.01.005.01') // A revenue and an expense
    .limit(5);

  if (error) { console.error(error); return; }
  console.table(data);
}

checkChartValues();
