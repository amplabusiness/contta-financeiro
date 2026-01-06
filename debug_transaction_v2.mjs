
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Searching...');
  const { data: txs, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .or('amount.eq.17.01,amount.eq.-17.01')
    .gte('transaction_date', '2025-02-01')
    .lte('transaction_date', '2025-02-28');

  if (error) console.error(error);
  else console.log('Found:', JSON.stringify(txs, null, 2));
  
  if (txs && txs.length > 0) {
      const tx = txs[0];
      if (tx.journal_entry_id) {
          const { data: lines } = await supabase
            .from('accounting_entry_lines')
            .select('*')
            .eq('entry_id', tx.journal_entry_id);
          console.log('Lines:', JSON.stringify(lines, null, 2));
      }
  }
}

check();
