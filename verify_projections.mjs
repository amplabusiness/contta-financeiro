
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function verifyViews() {
    console.log("🔍 Verifying Projections Views from Supabase...\n");

    // 1. Payroll
    const { data: payroll, error: err1 } = await supabase
        .from('v_projections_payroll')
        .select('*');

    if (err1) console.error("❌ Error Payroll:", err1);
    else {
        console.log(`✅ v_projections_payroll: Found ${payroll.length} rows.`);
        if (payroll.length > 0) console.table(payroll.slice(0, 3));
    }

    // 2. Contractors
    const { data: contractors, error: err2 } = await supabase
        .from('v_projections_contractors')
        .select('*');

    if (err2) console.error("❌ Error Contractors:", err2);
    else {
        console.log(`✅ v_projections_contractors: Found ${contractors.length} rows.`);
        if (contractors.length > 0) console.table(contractors.slice(0, 3));
    }
}

verifyViews();
