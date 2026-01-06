
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
  const terms = ['ECONET', 'REVISTAS', 'PERIODICOS', 'ASSINATURAS', 'SOFTWARE'];
  
  for (const term of terms) {
      const { data } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .ilike('name', `%${term}%`)
        .limit(5);
        
      console.log(`Results for "${term}":`, data);
  }
}

search();
