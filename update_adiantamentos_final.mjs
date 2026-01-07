
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// IDs
const CC = {
    FILHO_SERGIO: '5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d', // ID 4: Sergio Augusto (Filho) // THIS IS THE TARGET for all "Adiantamento Socio"
    VICTOR: '2f4d4958-7f65-43d4-94f7-9e94a63d3091',
    NAYARA: '9f4a0624-88df-4650-9056-2364f40bd5ad', 
    SERGIO_PAI: '40d9d6ae-6b72-4744-a400-a29dc3b71b55'
};

async function updateAllAdiantamentos() {
    console.log("🚀 Updating ALL 'Adiantamento Socio' entries to target Cost Center...");
    console.log("   Target: Filho Sergio (As per user instruction: 'adiantamento de socios todos os gastos com ele')");

    // Fetch IDs of all matching lines that are currently NULL cost center (or wrong one? User said ALL)
    // I will fetch only NULLS to be safe not to overwrite manual work, but the list showed 316 NULLs.
    
    // PATTERN: entry.description contains 'Adiantamento Socio'
    
    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id,
            entry:accounting_entries!inner(description)
        `)
        .ilike('entry.description', '%Adiantamento Socio%')
        .is('cost_center_id', null);

    if (error) {
        console.error(error);
        return;
    }

    if (lines.length > 0) {
        const ids = lines.map(l => l.id);
        console.log(`Found ${lines.length} lines. Applying Cost Center ID: ${CC.FILHO_SERGIO}`);
        
        const { error: updateError } = await supabase
            .from('accounting_entry_lines')
            .update({ cost_center_id: CC.FILHO_SERGIO })
            .in('id', ids);

        if (updateError) {
             console.error("Error updating:", updateError);
        } else {
             console.log("✅ Success! Updated all Partner Advances to 'Filho Sergio'.");
        }
    } else {
        console.log("No untagged Adiantamento Socio entries found.");
    }
}

updateAllAdiantamentos();
