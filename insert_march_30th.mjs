
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
const CC_CONTABIL = '67f8112d-a934-40c8-99bb-57630e29bc62'; 
const CC_DP = 'dff8e3e6-9f67-4908-a715-aeafe7715458'; 
const CC_GALERIA = '49b9cc90-9d24-479a-a770-06b669b961a1'; 
const CC_LAGO = 'f8a40a16-7555-4e0e-a67f-8736fb7ef21e'; 

const ACC_ADIANTAMENTO_SOCIO = 'b2845989-75af-4466-b3fb-473fb58e90a2'; 
const ACC_SALARIOS = '1dad2281-a86f-463b-b73b-4ec7f41492ec'; // Using Financeiro/Payment for now or explicit Salary account if found. usually 2.1.something. I'll stick to null for category mapping unless I find specific.

const expenses30th = [
    // Estimated 60% based on 15th (40%)
    { desc: 'JOSIMAR DOS SANTOS - CONTABIL - SALARIO 60%', amt: 3762.00, cat: 'Salários e Ordenados', cc: CC_CONTABIL }, // 2508 / 0.4 * 0.6
    { desc: 'THAYNARA - CONTABIL - SALARIO 60%', amt: 2236.65, cat: 'Salários e Ordenados', cc: CC_CONTABIL }, // 1491.10 / 0.4 * 0.6
    { desc: 'DEUSA - RH - SALARIO 60%', amt: 1800.00, cat: 'Salários e Ordenados', cc: CC_DP }, // 1200 / 0.4 * 0.6
    
    // Explicit values
    { desc: 'LILIAN MOREIRA - SALARIO 60%', amt: 1500.00, cat: 'Salários e Ordenados', cc: CC_ADMIN },
    { desc: 'MARIA JOSE - SECRETARIA DO LAGO', amt: 130.00, cat: 'Despesas Pessoais', cc: CC_LAGO, is_personal: true },
    { desc: 'CONDOMINIO SALA 301 GALERIA NACIONAL', amt: 434.84, cat: 'Despesas Pessoais', cc: CC_GALERIA, is_personal: true },
    { desc: 'CONDOMINIO SALA 302 GALERIA NACIONAL', amt: 345.59, cat: 'Despesas Pessoais', cc: CC_GALERIA, is_personal: true },
    { desc: 'CONDOMINIO SALA 303 GALERIA NACIONAL', amt: 345.59, cat: 'Despesas Pessoais', cc: CC_GALERIA, is_personal: true },
    { desc: 'PRONAMPE SCALA SICREDI - 03832285000115', amt: 1100.00, cat: 'Despesas Pessoais', cc: CC_ADMIN, is_personal: true }, // Scala debt -> Personal/Socio
];

async function run() {
    console.log("Upserting March 2025 Expenses (Due 30/03/2025)...");

    const dueDate = '2025-03-30';
    const competence = '03/2025';

    for (const item of expenses30th) {
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
            chart_account_id: item.is_personal ? ACC_ADIANTAMENTO_SOCIO : null,
            is_recurring: true,
            recurrence_day: 30,
            recurrence_end_date: null,
            created_by: USER_ID,
            notes: item.is_personal 
                ? 'Classificado como Adiantamento Sócio (Ativo) - Ref: Dr. Cicero'
                : 'Folha Pagamento 60%'
        };

        const { error } = await supabase.from('expenses').insert(payload);
        if (error) {
            console.error(`Error inserting ${item.desc}:`, error.message);
        } else {
            console.log(`Inserted: ${item.desc}`);
        }
    }
    
    console.log("--- MISSING VALUES (SKIPPED) ---");
    console.log("1. CELINA - FISCAL (No basis for calculation)");
    console.log("2. COMISSÃO DANIEL - ACTION- JUNHO 2024");
    console.log("3. VALE REFEIÇÃO - VR");
    console.log("4. VALE TRANSPORTE - FABIANA");
}

run();
