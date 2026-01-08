
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

const AMPLA_ID = 'b9787ade-778a-48d4-804b-21f682462fa6'; // AMPLA CONTABILIDADE

const marchExpenses = [
    { desc: 'E-CONNECT - MENSALIDADE', amt: 143.15, recurring: true },
    { desc: 'SEGURANÇA DO PREDIO MENSALIDADE - COP', amt: 197.00, recurring: true },
    { desc: 'IPVA 2024 - ONIX (PARCELA 9/10)', amt: 341.68, recurring: false },
    { desc: 'ACESSORIAS TECNOLOGIA (1º PARCELA)', amt: 370.00, recurring: true },
    { desc: 'ADVANCE - MANUTENÇÃO DO ELEVADOR', amt: 200.00, recurring: true },
    { desc: 'COMISSÃO DANIEL - SOARES E CHAGAS (11/23 E 06/24)', amt: 671.61, recurring: false }, // Treating as one-off or specific per desc
    { desc: 'ANUIDADE OAB SERGIO (PARCELA 9/11)', amt: 111.96, recurring: false },
    { desc: 'ANUIDADE OAB NAYARA (PARCELA 9/11)', amt: 111.96, recurring: false },
    { desc: 'IPTU PREDIO PARCELAMENTO 2022 (PARCELA 11 DE 60)', amt: 589.68, recurring: false }
];

async function run() {
    console.log("Upserting March 2025 Expenses (Due 05/03/2025)...");

    const dueDate = '2025-03-05';
    const competence = '03/2025';

    for (const item of marchExpenses) {
        // Check if exists
        const { data: existing } = await supabase
            .from('expenses')
            .select('id')
            .eq('description', item.desc)
            .eq('due_date', dueDate)
            .eq('amount', item.amt) // stricter check to avoid dups if run multiple times
            .maybeSingle();

        if (existing) {
            console.log(`Skipping existing: ${item.desc}`);
            continue;
        }

        const payload = {
            description: item.desc,
            amount: item.amt,
            due_date: dueDate,
            competence: competence,
            status: 'pending', // DEVENDO/A PAGAR
            client_id: AMPLA_ID,
            category_id: null, // Optional, can map later
            is_recurring: item.recurring,
            recurrence_day: 5,
            notes: 'Criado via Agente IA - Lançamento Recorrente/Parcelado'
        };

        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
            console.error(`Error inserting ${item.desc}:`, error.message);
        } else {
            console.log(`Inserted: ${item.desc}`);
        }
    }
    
    // Also, user mentioned "criar pagamentos 12, 13 e por ai vai" (future installments).
    // Let's create April and May for the short installments (IPVA, OAB).
    // IPVA 10/10 (Apr)
    // OAB 10/11 (Apr), 11/11 (May)
    
    console.log("Generating future installments for IPVA and OAB...");
    
    // IPVA April
    await insertFuture('IPVA 2024 - ONIX (PARCELA 10/10)', 341.68, '2025-04-05', '04/2025');
    
    // OAB April
    await insertFuture('ANUIDADE OAB SERGIO (PARCELA 10/11)', 111.96, '2025-04-05', '04/2025');
    await insertFuture('ANUIDADE OAB NAYARA (PARCELA 10/11)', 111.96, '2025-04-05', '04/2025');
    
    // OAB May
    await insertFuture('ANUIDADE OAB SERGIO (PARCELA 11/11)', 111.96, '2025-05-05', '05/2025'); // 5th is usually Monday in May 2025? 5th May 2025 is Monday.
    await insertFuture('ANUIDADE OAB NAYARA (PARCELA 11/11)', 111.96, '2025-05-05', '05/2025');

    console.log("Done.");
}

async function insertFuture(desc, amt, due, comp) {
    const { data: existing } = await supabase
        .from('expenses')
        .select('id')
        .eq('description', desc)
        .eq('due_date', due)
        .maybeSingle();

    if (existing) {
        console.log(`Skipping future: ${desc}`);
        return;
    }

    const payload = {
        description: desc,
        amount: amt,
        due_date: due,
        competence: comp,
        status: 'pending',
        client_id: AMPLA_ID,
        is_recurring: false,
        notes: 'Parcela Futura Gerada Automaticamente'
    };

    const { error } = await supabase.from('expenses').insert(payload);
    if (error) {
        console.error(`Error inserting future ${desc}:`, error.message);
    } else {
        console.log(`Inserted future: ${desc}`);
    }
}

run();
