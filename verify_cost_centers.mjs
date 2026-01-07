
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function verifyUpdates() {
    console.log("🕵️ Verifying Cost Center Updates...");

    // Check Sergio Augusto (Should be Filho Sergio)
    const { data: sergioData } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id, 
            cost_center_id, 
            entry:accounting_entries!inner(description),
            cost_center:cost_centers(name)
        `)
        .ilike('entry.description', '%SERGIO AUGUSTO%')
        .limit(5);

    console.log("\n--- SERGIO AUGUSTO ---");
    if (sergioData) {
        sergioData.forEach(r => {
            console.log(`Entry: ${r.entry.description.substring(0, 40)}...`);
            console.log(`CC Name: ${r.cost_center?.name}`);
            console.log(`CC ID: ${r.cost_center_id}`);
            console.log('---');
        });
    }

    // Check Daniel Rodrigues (Should be Fiscal)
    const { data: danielData } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id, 
            cost_center_id, 
            entry:accounting_entries!inner(description),
            cost_center:cost_centers(name)
        `)
        .ilike('entry.description', '%DANIEL RODRIGUES%')
        .limit(5);

    console.log("\n--- DANIEL RODRIGUES ---");
    if (danielData) {
        danielData.forEach(r => {
            console.log(`Entry: ${r.entry.description.substring(0, 40)}...`);
            console.log(`CC Name: ${r.cost_center?.name}`);
            console.log('---');
        });
    }
}

verifyUpdates();
