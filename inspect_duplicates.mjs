
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDuplicates() {
  console.log("🔍 Inspecting Duplicates for IUVACI (Example)...\n");

  const { data: clients } = await supabase.from('clients').select('id').ilike('name', '%IUVACI%').single();
  const clientId = clients.id;

  const { data: balances } = await supabase
    .from('client_opening_balance')
    .select('id, competence, amount, created_at, description')
    .eq('client_id', clientId)
    .in('competence', ['12/2024', '13/2024'])
    .order('competence', { ascending: true });

  console.table(balances);
}

inspectDuplicates();
