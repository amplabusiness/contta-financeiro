
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectInvoices() {
    console.log("🔍 Inspecting Invoices for 01/2025...");
    
    // Get distribution of types
    const { data: types, error } = await supabase
        .from('invoices')
        .select('type')
        .eq('competence', '01/2025');

    if (error) {
        console.error(error);
        return;
    }

    const counts = {};
    const total = types.length;
    types.forEach(t => {
        const type = t.type || 'NULL';
        counts[type] = (counts[type] || 0) + 1;
    });
    
    console.log(`Total Invoices: ${total}`);
    console.table(counts);

    // Check 2026
    console.log("\n🔍 Inspecting Invoices for 01/2026...");
    const { data: types26 } = await supabase
        .from('invoices')
        .select('type')
        .eq('competence', '01/2026');
        
    const counts26 = {};
    types26.forEach(t => {
        const type = t.type || 'NULL';
        counts26[type] = (counts26[type] || 0) + 1;
    });
    console.log(`Total Invoices: ${types26.length}`);
    console.table(counts26);
}

inspectInvoices();
