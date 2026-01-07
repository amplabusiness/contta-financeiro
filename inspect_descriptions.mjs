
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspectData() {
    console.log("🔍 Inspecting Data Locations...");
    
    // Fetch a few lines
    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id, 
            description, 
            amount:credit, 
            entry:accounting_entries (
                description
            )
        `)
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.log("Found:", lines.length);
    lines.forEach(l => {
        console.log(`Line ID: ${l.id}`);
        console.log(`   Line Desc: ${l.description}`);
        console.log(`   Entry Desc: ${l.entry?.description}`);
        console.log('---');
    });
}

inspectData();
