
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

const clientsToRegister = [
    { name: "PATRICIA PEREZ ACESSORIOS PARA NOIVAS LTDA", cnpj: "09283622000149" },
    { name: "MARO AGROPECUARIA E PARTICIPACOES LTDA", cnpj: "14782641000150" },
    { name: "MARCUS VINICIUS LEAL PIRES", cnpj: "33035671000147" }
];

async function run() {
    for (const client of clientsToRegister) {
        // Check if exists by CNPJ
        const { data: existing } = await supabase.from('clients')
            .select('id, name')
            .eq('cnpj', client.cnpj)
            .single();

        if (existing) {
            console.log(`Client already exists: ${existing.name} (${existing.id})`);
        } else {
            console.log(`Registering new client: ${client.name}...`);
            const { data: newClient, error } = await supabase.from('clients').insert({
                name: client.name.toUpperCase(),
                cnpj: client.cnpj,
                is_active: true
            }).select().single();

            if (error) {
                console.error(`Error registering ${client.name}:`, error.message);
            } else {
                console.log(`Success! Created ID: ${newClient.id}`);
            }
        }
    }
}

run();
