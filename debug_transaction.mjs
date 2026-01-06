
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Search for transaction related to 34.02 or 17.01
  const { data: txs, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .gte('transaction_date', '2025-02-01')
    .lte('transaction_date', '2025-02-28');

  if (error) { console.error(error); return; }

  const target = txs.filter(t => Math.abs(t.amount) === 34.02 || Math.abs(t.amount) === 17.01);
  console.log('Found transactions:', target);

  if (target.length > 0) {
    const tx = target[0];
    console.log('Inspecting Transaction:', tx.description, tx.amount, tx.id);
    
    if (tx.journal_entry_id) {
        const { data: lines } = await supabase
            .from('accounting_entry_lines')
            .select('*')
            .eq('entry_id', tx.journal_entry_id);
        console.log('Accounting Lines:', lines);
    } else {
        console.log('No journal_entry_id linked.');
    }
  }
}

check();
