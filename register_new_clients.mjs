
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

const newClients = [
    { name: 'GEANINNE AGROPECUARIA LTDA', cnpj: '35027938000180' },
    { name: 'INNOVARE DESPACHANTES LTDA', cnpj: '55776490000104' }
];

async function run() {
    console.log("Registering provided clients...");

    for (const c of newClients) {
        // Upsert by CNPJ if possible, or just insert
        // Check if exists
        const { data: existing } = await supabase.from('clients').select('id').eq('cnpj', c.cnpj).maybeSingle();
        
        if (existing) {
            console.log(`Client already exists (CNPJ ${c.cnpj}): ${c.name}`);
        } else {
            const { data, error } = await supabase.from('clients').insert({
                name: c.name,
                cnpj: c.cnpj,
                is_active: true
            }).select();

            if (error) console.error(`Error inserting ${c.name}:`, error.message);
            else console.log(`Registered: ${c.name}`);
        }
    }
}

run();
