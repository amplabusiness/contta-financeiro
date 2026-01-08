
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

const AMPLA_ID = 'b9787ade-778a-48d4-804b-21f682462fa6'; 
const USER_ID = 'e3a168e5-4339-4c7c-a8e2-dd2ee84daae9'; 
const VALU_DEFAULT = 162.00;

// Cost Center: Administrativo
const CC_ADMIN = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'; 

const batch = [
    { ref: 'jan/25', due: '2025-02-05', status: 'paid', paid_at: null, note: 'BOLETO SICREDI' },
    { ref: 'fev/25', due: '2025-03-05', status: 'paid', paid_at: '2025-04-22', note: 'PIX SICREDI' },
    { ref: 'mar/25', due: '2025-04-05', status: 'paid', paid_at: '2025-04-22', note: 'PIX SICREDI' },
    { ref: 'abr/25', due: '2025-05-05', status: 'paid', paid_at: '2025-10-31', note: 'PIX SICREDI' },
    { ref: 'mai/25', due: '2025-06-05', status: 'paid', paid_at: '2025-08-06', note: 'PIX SICREDI' },
    { ref: 'jun/25', due: '2025-07-05', status: 'paid', paid_at: '2025-08-06', note: 'PIX SICREDI' },
    { ref: 'jul/25', due: '2025-08-05', status: 'paid', paid_at: '2025-08-06', note: 'PIX SICREDI' },
    { ref: 'ago/25', due: '2025-09-05', status: 'paid', paid_at: '2025-10-31', note: 'PIX SICREDI' },
    { ref: 'set/25', due: '2025-10-05', status: 'paid', paid_at: '2025-10-31', note: 'PIX SICREDI' },
    { ref: 'out/25', due: '2025-11-05', status: 'paid', paid_at: '2025-12-02', note: 'PIX SICREDI' },
    { ref: 'nov/25', due: '2025-12-05', status: 'paid', paid_at: '2025-12-19', note: 'PIX SICREDI' },
    { ref: '13/2025', due: '2025-12-20', status: 'pending', paid_at: null, note: 'A VENCER' },
    { ref: 'dez/25', due: '2026-01-05', status: 'pending', paid_at: null, note: 'A VENCER' }
];

async function run() {
    console.log("Upserting VR CONSULTORIAS Honorários (2025)...");

    for (const item of batch) {
        const description = `HONORÁRIOS VR CONSULTORIAS - ${item.ref.toUpperCase()}`;
        
        // Competence: '01/2025', etc.
        let competence = item.ref;
        if (item.ref === '13/2025') competence = '13/2025'; // Or just leave as string
        else {
            const parts = item.ref.split('/');
            // map jan->01
            const months = {jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06', jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12'};
            if (months[parts[0]]) competence = `${months[parts[0]]}/20${parts[1]}`;
        }

        // Check if exists
        const { data: existing } = await supabase
            .from('expenses')
            .select('id')
            .eq('description', description)
            .eq('due_date', item.due)
            .maybeSingle();

        if (existing) {
            console.log(`Skipping existing: ${description}`);
            
            // Optional: Update payment status if it was pending and now is paid
            if (item.status === 'paid') {
                 await supabase.from('expenses').update({ 
                     status: 'paid', 
                     payment_date: item.paid_at,
                     notes: `Atualizado via IA: ${item.note}`
                 }).eq('id', existing.id);
            }
            continue;
        }

        const payload = {
            description: description,
            amount: VALU_DEFAULT,
            due_date: item.due,
            payment_date: item.paid_at,
            competence: competence,
            status: item.status, 
            client_id: AMPLA_ID,
            category: 'Honorários', 
            category_id: null,
            cost_center_id: CC_ADMIN,
            is_recurring: true,
            created_by: USER_ID,
            notes: `Forma Pagamento: ${item.note} - Inserido via Agente IA`
        };

        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
            console.error(`Error inserting ${description}:`, error.message);
        } else {
            console.log(`Inserted: ${description}`);
        }
    }
}

run();
