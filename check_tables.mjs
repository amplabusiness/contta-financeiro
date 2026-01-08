
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

async function run() {
    console.log("Checking 'invoices' table structure...");
    const { data, error } = await supabase.from('invoices').select('*').limit(1);
    if (error) {
        console.log("Error querying invoices:", error.message);
        // Try 'revenue' or 'receivables'
        const { data: rev, error: errRev } = await supabase.from('revenue').select('*').limit(1);
        if (errRev) console.log("Error querying revenue:", errRev.message);
        else console.log("Found 'revenue' table:", Object.keys(rev[0] || {}));
    } else {
        console.log("Found 'invoices' table. Columns:", Object.keys(data[0] || {}));
    }

    // Check 'clients' or 'customers' table to map names
    const { data: clients, error: errClients } = await supabase.from('clients').select('*').limit(1);
    if(errClients) console.log("Error querying clients:", errClients.message);
    else console.log("Found 'clients' table columns:", Object.keys(clients[0] || {}));
}

run();
