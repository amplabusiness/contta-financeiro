
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) envPath = path.join(__dirname, '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const anonKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const serviceKeyMatch = envContent.match(/SupabaseServiceRole=(.+)/) || envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch?.[1]?.trim();
const supabaseKey = serviceKeyMatch?.[1]?.trim() || anonKeyMatch?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    // Check expenses columns
    const { data: exp } = await supabase.from('expenses').select('*').limit(1);
    if (exp) console.log('Expenses columns:', Object.keys(exp[0] || {}));

    // Check recurring_expenses columns
    const { data: rec } = await supabase.from('recurring_expenses').select('*').limit(1);
    if (rec) console.log('Recurring Expenses columns:', Object.keys(rec[0] || {}));

    // Look for AMPLA in clients or just use a name in expense?
    const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', '%AMPLA%');
    console.log('Ampla clients:', clients);
}

inspect();
