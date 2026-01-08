
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

const S_CARNEIRO_ACC_ID = 'b2845989-75af-4466-b3fb-473fb58e90a2'; // Adiantamento Sérgio Carneiro
const DUE_DATE = '2025-03-10';

const ITEMS_TO_UPDATE = [
    'GÁS APTO SERGIO',
    'CONDOMINIO APT SERGIO',
    'CASAG - PLANO DE SAUDE',
    'ANTONIO LEANDRO',
    'INTERNET LAGO',
    'INTERNET APT SERGIO'
];

async function run() {
    console.log("Updating March 10th expenses to 'Adiantamento de Sócios'...");

    const { data: expenses, error } = await supabase
        .from('expenses')
        .select('id, description')
        .in('description', ITEMS_TO_UPDATE)
        .eq('due_date', DUE_DATE);

    if (error) {
        console.error("Error finding expenses:", error);
        return;
    }

    console.log(`Found ${expenses.length} items to update.`);

    for (const exp of expenses) {
        const { error: updateError } = await supabase
            .from('expenses')
            .update({ 
                chart_account_id: S_CARNEIRO_ACC_ID,
                notes: 'Classificado como Adiantamento Sócio (Ativo) - Ref: Dr. Cicero'
            })
            .eq('id', exp.id);

        if (updateError) console.error(`Failed to update ${exp.description}:`, updateError.message);
        else console.log(`Updated classification for: ${exp.description}`);
    }
}

run();
