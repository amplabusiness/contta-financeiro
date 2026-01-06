
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchAccounts() {
  console.log('Searching for accounts...');

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%revistas%') // Search for Revistas
    .order('code');

  if (error) {
     console.error(error);
  } else {
     console.log('Found accounts for "Revistas":', data);
  }

  const { data: data2 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%periodic%') // Search for Periodicos
    .order('code');
    
  console.log('Found accounts for "Periodicos":', data2);

  const { data: data3 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%software%') 
    .order('code');
    
  console.log('Found accounts for "Software":', data3);
}

searchAccounts();
