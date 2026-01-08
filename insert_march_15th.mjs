
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

// Cost Centers & Accounts
const CC_ADMIN = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'; // AMPLA.ADMINISTRATIVO
const CC_SISTEMAS = '1553c665-fdf4-4f43-98eb-6aacbfd88745'; // SISTEMAS.ERP
const CC_TELECOM = '4cc590cf-85e0-4680-b24e-e2a65ef2a8dd'; // AMPLA.TELECOM
const CC_SERGIO_CASA_CAMPO = 'f8a40a16-7555-4e0e-a67f-8736fb7ef21e'; // Lago
const CC_MATERIAL = '2aff05a0-8170-4849-a938-efaa3360336a'; // Material

const ACC_ADIANTAMENTO_FUNC = '0233dc27-3ea6-4e7b-a933-0f0790af29a4'; // 1.1.3.02
const ACC_ADIANTAMENTO_SOCIO = 'b2845989-75af-4466-b3fb-473fb58e90a2'; // 1.1.3.04.01 Adiantamento Sérgio Carneiro

const expenses15th = [
    { desc: 'LILIAN - AMPLA - ADIANTAMENTO 40%', amt: 1045.00, cat: 'Adiantamento Salarial', acc: ACC_ADIANTAMENTO_FUNC, cc: CC_ADMIN },
    { desc: 'JOSIMAR - CONTÁBIL - ADIANTAMENTO 40%', amt: 2508.00, cat: 'Adiantamento Salarial', acc: ACC_ADIANTAMENTO_FUNC, cc: CC_ADMIN },
    { desc: 'THAYNARA - CONTÁBIL - ADIANTAMENTO 40%', amt: 1491.10, cat: 'Adiantamento Salarial', acc: ACC_ADIANTAMENTO_FUNC, cc: CC_ADMIN },
    { desc: 'SUELI - COMPRA DE ENVELOPES E TESOURA', amt: 17.50, cat: 'Material de Escritório', acc: null, cc: CC_MATERIAL },
    { desc: 'DEUZA RESENDE DE JESUS - DP - ADIANTAMENTO 40%', amt: 1200.00, cat: 'Adiantamento Salarial', acc: ACC_ADIANTAMENTO_FUNC, cc: CC_ADMIN },
    { desc: 'FABIANA MARIA DA SILVA MENDONÇA - BABA', amt: 800.00, cat: 'Despesas Pessoais', acc: ACC_ADIANTAMENTO_SOCIO, cc: CC_ADMIN },
    { desc: 'ALGAR - INTERNET AMPLA', amt: 132.11, cat: 'Telecomunicações', acc: null, cc: CC_TELECOM },
    { desc: 'EQUATORIAL - ELEVADOR (UC 10038357346)', amt: 104.07, cat: 'Energia Elétrica', acc: null, cc: CC_ADMIN },
    { desc: 'EQUATORIAL AMPLA 10-2024', amt: 2188.16, cat: 'Energia Elétrica', acc: null, cc: CC_ADMIN },
    { desc: 'DATAUNIQUE', amt: 1410.00, cat: 'Sistemas', acc: null, cc: CC_SISTEMAS },
    { desc: 'INTERNT - TIM - AMPLA', amt: 137.55, cat: 'Telecomunicações', acc: null, cc: CC_TELECOM },
    { desc: 'SAAM SISTEMA - NF 68613', amt: 686.13, cat: 'Sistemas', acc: null, cc: CC_SISTEMAS },
    { desc: 'SAAM SISTEMA - NF 29406', amt: 294.06, cat: 'Sistemas', acc: null, cc: CC_SISTEMAS },
    { desc: 'COMISSÃO ALAN - TODAS AS EMPRESAS', amt: 598.11, cat: 'Comissões', acc: null, cc: CC_ADMIN },
    { desc: 'IPTU PARCELADO 2018-PREDIO AMPLA - PARCELA 12', amt: 2979.65, cat: 'Impostos e Taxas', acc: null, cc: CC_ADMIN }, 
    { desc: 'DOMINIO SISTEMA', amt: 2278.00, cat: 'Sistemas', acc: null, cc: CC_SISTEMAS },
    { desc: 'CONDOMIO DO LAGO', amt: 2682.57, cat: 'Despesas Pessoais', acc: ACC_ADIANTAMENTO_SOCIO, cc: CC_SERGIO_CASA_CAMPO },
    { desc: 'SÃO JOSE COMERCIO DE EMBALAGENS', amt: 187.00, cat: 'Material de Escritório', acc: null, cc: CC_MATERIAL }
];

async function run() {
    console.log("Upserting March 2025 Expenses (Due 15/03/2025)...");

    const dueDate = '2025-03-15';
    const competence = '03/2025';

    for (const item of expenses15th) {
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
            chart_account_id: item.acc, // Set specific account if known (Adiantamentos)
            is_recurring: true,
            recurrence_day: 15,
            recurrence_end_date: null,
            created_by: USER_ID,
            notes: 'Lançamento Recorrente (Dia 15) - Inserido via Agente IA'
        };

        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
            console.error(`Error inserting ${item.desc}:`, error.message);
        } else {
            console.log(`Inserted: ${item.desc}`);
        }
    }
    
    console.log("NOTE: 'CELINA - FISCAL FÉRIAS' was skipped (No value provided).");
}

run();
