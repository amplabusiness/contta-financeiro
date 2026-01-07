
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdjustmentIndices() {
  const { data, error } = await supabase
    .from('accounting_contracts')
    .select('adjustment_index');

  if (error) {
    console.error('Error fetching contracts:', error);
    return;
  }

  const indices = new Set(data.map(c => c.adjustment_index));
  console.log('Distinct adjustment indices:', [...indices]);
}

checkAdjustmentIndices();
