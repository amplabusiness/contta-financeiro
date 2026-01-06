
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBanks() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.1.%')
    .order('code');

  if (error) console.error(error);
  else console.table(data);
}

checkBanks();
