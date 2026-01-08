
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
    { desc: 'E-CONNECT - MENSALIDADE', amt: 143.15, recurring: true, cat: 'Sistemas' },
    { desc: 'SEGURANÇA DO PREDIO MENSALIDADE - COP', amt: 197.00, recurring: true, cat: 'Manutenção Predial' },
    { desc: 'IPVA 2024 - ONIX (PARCELA 9/10)', amt: 341.68, recurring: false, cat: 'Impostos e Taxas' },
    { desc: 'ACESSORIAS TECNOLOGIA (1º PARCELA)', amt: 370.00, recurring: true, cat: 'Serviços de Terceiros' },
    { desc: 'ADVANCE - MANUTENÇÃO DO ELEVADOR', amt: 200.00, recurring: true, cat: 'Manutenção Predial' },
    { desc: 'COMISSÃO DANIEL - SOARES E CHAGAS (11/23 E 06/24)', amt: 671.61, recurring: false, cat: 'Comissões' },
    { desc: 'ANUIDADE OAB SERGIO (PARCELA 9/11)', amt: 111.96, recurring: false, cat: 'Associações e Sindicatos' },
    { desc: 'ANUIDADE OAB NAYARA (PARCELA 9/11)', amt: 111.96, recurring: false, cat: 'Associações e Sindicatos' },
    { desc: 'IPTU PREDIO PARCELAMENTO 2022 (PARCELA 11 DE 60)', amt: 589.68, recurring: false, cat: 'Impostos e Taxas' }
];

const USER_ID = 'e3a168e5-4339-4c7c-a8e2-dd2ee84daae9'; // financeiro@amplabusiness.com.br

const CC_MAP = {
    'Sistemas': '1553c665-fdf4-4f43-98eb-6aacbfd88745', // SISTEMAS.ERP
    'Manutenção Predial': '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', // AMPLA.ADMINISTRATIVO (Fallback)
    'Impostos e Taxas': '64652429-95e9-4698-b254-a946e5b072b5', // AMPLA.IMPOSTOS
    'Serviços de Terceiros': '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', // AMPLA.ADMINISTRATIVO
    'Comissões': '1dad2281-a86f-463b-b73b-4ec7f41492ec', // AMPLA.FINANCEIRO
    'Associações e Sindicatos': '15bb56e2-42a2-48dc-9094-7924b951690d', // AMPLA.ANUIDADES
};
const CC_DEFAULT = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'; // AMPLA.ADMINISTRATIVO
const CC_IPTU = '7a18a8ca-8e1b-4a89-a71b-38b5e9a170fc'; // AMPLA.IPTU

function getCostCenter(cat, desc) {
    if (desc.includes('IPTU')) return CC_IPTU;
    return CC_MAP[cat] || CC_DEFAULT;
}

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
            competence: competence,
            status: 'pending', 
            client_id: AMPLA_ID,
            category: item.cat, 
            category_id: null,
            cost_center_id: getCostCenter(item.cat, item.desc), // ADDED cost_center_id
            is_recurring: item.recurring,
            recurrence_day: 5,
            created_by: USER_ID,
            notes: 'Criado via Agente IA - Lançamento Recorrente/Parcelado'
        };

        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
            console.error(`Error inserting ${item.desc}:`, error.message);
        } else {
            console.log(`Inserted: ${item.desc}`);
        }
    }
    
    console.log("Generating future installments for IPVA and OAB...");
    
    // IPVA April
    await insertFuture('IPVA 2024 - ONIX (PARCELA 10/10)', 341.68, '2025-04-05', '04/2025', 'Impostos e Taxas');
    
    // OAB April
    await insertFuture('ANUIDADE OAB SERGIO (PARCELA 10/11)', 111.96, '2025-04-05', '04/2025', 'Associações e Sindicatos');
    await insertFuture('ANUIDADE OAB NAYARA (PARCELA 10/11)', 111.96, '2025-04-05', '04/2025', 'Associações e Sindicatos');
    
    // OAB May
    await insertFuture('ANUIDADE OAB SERGIO (PARCELA 11/11)', 111.96, '2025-05-05', '05/2025', 'Associações e Sindicatos');
    await insertFuture('ANUIDADE OAB NAYARA (PARCELA 11/11)', 111.96, '2025-05-05', '05/2025', 'Associações e Sindicatos');

    console.log("Done.");
}

async function insertFuture(desc, amt, due, comp, cat) {
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
        category: cat,
        cost_center_id: getCostCenter(cat, desc), // ADDED cost_center_id
        is_recurring: false,
        created_by: USER_ID,
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
