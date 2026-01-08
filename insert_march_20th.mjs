
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

// Cost Centers
const CC_ADMIN = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'; 
const CC_IMPOSTOS = '64652429-95e9-4698-b254-a946e5b072b5'; // AMPLA.IMPOSTOS
const CC_SISTEMAS = '1553c665-fdf4-4f43-98eb-6aacbfd88745'; 
const CC_COPA = '71e700e0-a934-4aa8-9ad2-7cfce2c2cc91'; // AMPLA.COPA.AGUA
const CC_APT_SERGIO = '30626b61-42c1-41bb-a52c-b40d296b3f6f'; // Imoveis
const CC_VILA_ABAJA = 'ad2ac6be-1936-44ff-a7f0-02183daa640a'; // Vila Abaja
const CC_GALERIA = '49b9cc90-9d24-479a-a770-06b669b961a1'; // Galeria Nacional

// Accounts
const ACC_ADIANTAMENTO_SOCIO = 'b2845989-75af-4466-b3fb-473fb58e90a2'; 

const expenses20th = [
    { desc: 'DARF PREVIDENCIARIO INSS E IRPF SCALA', amt: 2493.89, cat: 'Impostos e Taxas', cc: CC_IMPOSTOS },
    { desc: 'FGTS SCALA', amt: 1884.14, cat: 'Impostos e Taxas', cc: CC_IMPOSTOS },
    { desc: 'VERI SISTEMA', amt: 418.00, cat: 'Sistemas', cc: CC_SISTEMAS },
    { desc: 'EQUATORIAL APT SERGIO', amt: 454.16, cat: 'Utilidades', cc: CC_APT_SERGIO, is_personal: true },
    { desc: 'DAS SIMPLES SCALA', amt: 2881.41, cat: 'Impostos e Taxas', cc: CC_IMPOSTOS },
    { desc: 'COMISSÃO DANIEL - MATA PRAGAS', amt: 1385.62, cat: 'Comissões', cc: CC_ADMIN },
    { desc: 'IPTU 2024 - PREDIO 9/11', amt: 3580.35, cat: 'Impostos e Taxas', cc: CC_IMPOSTOS },
    { desc: 'IPTU 2024 VILA ABAJA 8/11', amt: 135.25, cat: 'Impostos e Taxas', cc: CC_VILA_ABAJA, is_personal: true },
    { desc: 'IPTU 2024 GALERIA NACIONAL SALA 301 8/11', amt: 100.15, cat: 'Impostos e Taxas', cc: CC_GALERIA, is_personal: true },
    { desc: 'IPTU 2024 GALERIA NACIONAL SALA 302 8/11', amt: 79.55, cat: 'Impostos e Taxas', cc: CC_GALERIA, is_personal: true },
    { desc: 'IPTU 2024 GALERIA NACIONAL SALA 303 8/11', amt: 79.55, cat: 'Impostos e Taxas', cc: CC_GALERIA, is_personal: true },
    { desc: 'IPTU 2024 APT SERGIO 7/11', amt: 190.84, cat: 'Impostos e Taxas', cc: CC_APT_SERGIO, is_personal: true },
    { desc: 'TANGERINO', amt: 99.90, cat: 'Sistemas', cc: CC_SISTEMAS },
    { desc: 'SUELI - REMEDIO', amt: 139.90, cat: 'Despesas Pessoais', cc: CC_ADMIN, is_personal: true },
    { desc: '8 GALÃO DE AGUA', amt: 88.00, cat: 'Material de Consumo', cc: CC_COPA },
    { desc: 'SUELI - BOLÃO DO SERGIO', amt: 5.00, cat: 'Despesas Pessoais', cc: CC_ADMIN, is_personal: true },
    { desc: 'AR CONDICIONADO - SALA SUELI', amt: 220.00, cat: 'Manutenção Predial', cc: CC_ADMIN },
    { desc: 'AR CONDICIONADO SALA FINANCEIRO', amt: 180.00, cat: 'Manutenção Predial', cc: CC_ADMIN }
];

async function run() {
    console.log("Upserting March 2025 Expenses (Due 20/03/2025)...");

    const dueDate = '2025-03-20';
    const competence = '03/2025';

    for (const item of expenses20th) {
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
            cost_center_id: item.cc,
            chart_account_id: item.is_personal ? ACC_ADIANTAMENTO_SOCIO : null, // Auto-classify personal
            is_recurring: true,
            recurrence_day: 20,
            recurrence_end_date: null,
            created_by: USER_ID,
            notes: item.is_personal 
                ? 'Classificado como Adiantamento Sócio (Ativo) - Ref: Dr. Cicero'
                : 'Lançamento Recorrente (Dia 20) - Inserido via Agente IA'
        };

        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
            console.error(`Error inserting ${item.desc}:`, error.message);
        } else {
            console.log(`Inserted: ${item.desc}`);
        }
    }
}

run();
