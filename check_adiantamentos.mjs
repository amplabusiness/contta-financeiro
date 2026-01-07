
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAdiantamentos() {
    console.log("🔍 Checking 'Adiantamento Socio' entries...");

    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id, 
            cost_center_id, 
            description,
            entry:accounting_entries!inner(description),
            cost_center:cost_centers(name)
        `)
        .ilike('entry.description', '%Adiantamento Socio%')
        .is('cost_center_id', null); // Only check those null? Or check all to see if strictly mapped?

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${lines.length} 'Adiantamento Socio' entries.`);
    
    // Check distribution
    const distribution = {};
    lines.forEach(l => {
        const cc = l.cost_center?.name || 'NULL';
        distribution[cc] = (distribution[cc] || 0) + 1;
        
        if (cc === 'NULL') {
            console.log(`   [NULL CC] ${l.entry.description} | Line: ${l.description}`);
        }
    });
    
    console.log("Distribution:", distribution);
}

checkAdiantamentos();
