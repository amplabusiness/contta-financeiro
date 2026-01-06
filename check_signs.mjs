
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: txs, error } = await supabase
    .from('bank_transactions')
    .select('description, amount, transaction_type')
    .gte('transaction_date', '2025-02-01')
    .limit(5);

  if (error) console.error(error);
  else console.log(JSON.stringify(txs, null, 2));
}

check();
