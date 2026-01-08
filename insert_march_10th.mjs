
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

// Items due on the 10th
const expenses10th = [
    { desc: 'GÁS APTO SERGIO', amt: 81.65, cat: 'Utilidades', recurring: true },
    { desc: 'CONDOMINIO APT SERGIO', amt: 1360.77, cat: 'Moradia', recurring: true },
    { desc: 'CASAG - PLANO DE SAUDE', amt: 4339.32, cat: 'Saúde', recurring: true },
    { desc: 'ANTONIO LEANDRO', amt: 800.00, cat: 'Serviços de Terceiros', recurring: true },
    { desc: 'INTERNET LAGO', amt: 100.00, cat: 'Telecomunicações', recurring: true },
    { desc: 'INTERNET APT SERGIO', amt: 182.66, cat: 'Telecomunicações', recurring: true }
];

// Special case: CONDOMINIO DO LAGO - PEGAR COM JOSIMAR (Value unknown)

const CC_MAP = {
    'Sistemas': '1553c665-fdf4-4f43-98eb-6aacbfd88745',
    'Manutenção Predial': '9ebaef20-e25d-40b3-97bf-f44b1499a3e4',
    'Impostos e Taxas': '64652429-95e9-4698-b254-a946e5b072b5',
    'Serviços de Terceiros': '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', 
    'Comissões': '1dad2281-a86f-463b-b73b-4ec7f41492ec',
    'Associações e Sindicatos': '15bb56e2-42a2-48dc-9094-7924b951690d',
    'Utilidades': '30626b61-42c1-41bb-a52c-b40d296b3f6f', // Default to Imóveis for Gás?
    'Moradia': '30626b61-42c1-41bb-a52c-b40d296b3f6f', // Imóveis
    'Saúde': 'ae236505-f276-4e07-9f63-0bede4066cfd', // Beneficios
    'Telecomunicações': '4cc590cf-85e0-4680-b24e-e2a65ef2a8dd' // AMPLA.TELECOM (Default)
};

const CC_SERGIO_IMOVEIS = '30626b61-42c1-41bb-a52c-b40d296b3f6f'; // 3.2 SERGIO.IMOVEIS
const CC_SERGIO_CASA_CAMPO = 'f8a40a16-7555-4e0e-a67f-8736fb7ef21e'; // 3.2.1 SERGIO.CASA_CAMPO
const CC_AMPLA_BENEFICIOS = 'ae236505-f276-4e07-9f63-0bede4066cfd';

function getCostCenter(cat, desc) {
    const d = desc.toUpperCase();
    if (d.includes('APT SERGIO') || d.includes('APTO SERGIO')) return CC_SERGIO_IMOVEIS;
    if (d.includes('LAGO')) return CC_SERGIO_CASA_CAMPO;
    if (d.includes('CASAG')) return CC_AMPLA_BENEFICIOS;
    
    return CC_MAP[cat] || '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'; // Default Admin
}

async function run() {
    console.log("Upserting March 2025 Expenses (Due 10/03/2025)...");

    const dueDate = '2025-03-10';
    const competence = '03/2025';

    for (const item of expenses10th) {
        // Check if exists
        const { data: existing } = await supabase
            .from('expenses')
            .select('id')
            .eq('description', item.desc)
            .eq('due_date', dueDate)
            .eq('amount', item.amt)
            .maybeSingle();

        if (existing) {
            console.log(`Skipping existing: ${item.desc}`);
            continue;
        }

        const payload = {
            description: item.desc,
            amount: item.amt,
            due_date: dueDate,
            payment_date: null, // Open
            competence: competence,
            status: 'pending', 
            client_id: AMPLA_ID,
            category: item.cat, 
            category_id: null,
            cost_center_id: getCostCenter(item.cat, item.desc),
            is_recurring: item.recurring,
            recurrence_day: 10,
            
            // Support for cancellation request
            recurrence_end_date: null, // Explicitly open-ended until cancelled

            created_by: USER_ID,
            notes: 'Lançamento Recorrente - Inserido via Agente IA'
        };

        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
            console.error(`Error inserting ${item.desc}:`, error.message);
        } else {
            console.log(`Inserted: ${item.desc}`);
        }
    }
    
    console.log("ALERT: 'CONDOMINIO DO LAGO' was skipped (Missing Value - 'PEGAR COM JOSIMAR'). Please update manually.");
}

run();
