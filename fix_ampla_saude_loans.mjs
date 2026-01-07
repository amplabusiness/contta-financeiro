
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
    AMPLA_SAUDE: 'e84d8dd4-7ca8-4a3a-8390-e6487e54f20c', // 2. AMPLA.SAUDE
    FILHO_SERGIO: '5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d' // The one we mistakenly put everything in
};

async function fixAmplaSaude() {
    console.log("🚑 Fixing 'Ampla Saúde Ocupacional' entries (Loans/Investments)...");
    
    // Find entries with 'Ampla Saude' or 'AMPLA SAUDE' in description
    // that are currently tagged as FILHO_SERGIO (or just generally matching the pattern)
    
    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id,
            cost_center_id,
            entry:accounting_entries!inner(description)
        `)
        .ilike('entry.description', '%AMPLA SAUDE%');

    if (error) {
        console.error("Error searching:", error);
        return;
    }

    console.log(`Found ${lines.length} entries for Ampla Saude.`);

    if (lines.length > 0) {
        const ids = lines.map(l => l.id);
        
        // Update to AMPLA_SAUDE Cost Center
        const { error: updateError } = await supabase
            .from('accounting_entry_lines')
            .update({ cost_center_id: CC.AMPLA_SAUDE })
            .in('id', ids);

        if (updateError) {
             console.error("Error updating:", updateError);
        } else {
             console.log(`✅ Success! Moved ${lines.length} entries to Cost Center 'Ampla Saúde' (Asset/Loan).`);
        }
    }
}

fixAmplaSaude();
