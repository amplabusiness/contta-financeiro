
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAccounts() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%Outros%')
    .order('code');

  if (error) console.error(error);
  else console.table(data);

  const { data: data2 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%Empr%') // Empréstimos
    .order('code');

  if (data2) console.table(data2);
}

checkAccounts();
