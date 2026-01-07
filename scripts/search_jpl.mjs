
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function deepSearch() {
   console.log('--- Search in chart_accounts for JPL ---');
   const { data: ca } = await supabase.from('chart_accounts').select('*').ilike('name', '%JPL%');
   if (ca) ca.forEach(a => console.log(`[CHART] ${a.code} - ${a.name} (ID: ${a.id})`));

   console.log('\n--- Search in clients for JPL ---');
   const { data: cl } = await supabase.from('clients').select('*').ilike('name', '%JPL%');
   if (cl) cl.forEach(c => console.log(`[CLIENT] ${c.name} (ID: ${c.id})`));
   
   console.log('\n--- Search in chart_of_accounts VIEW for JPL ---');
   const { data: v } = await supabase.from('chart_of_accounts').select('*').ilike('name', '%JPL%');
   if (v) v.forEach(a => console.log(`[VIEW] ${a.code} - ${a.name}`));
}

deepSearch();
