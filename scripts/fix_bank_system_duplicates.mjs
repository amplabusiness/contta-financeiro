
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function finalNuke() {
    console.log("=== FINAL NUKE: Deleting System Entries ===");

    const { data: acc } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.1.05').single();
    if (!acc) return;
    const accountId = acc.id;

    // Fetch ALL lines
    const { data: entries, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id, 
            entry_id,
            accounting_entries!inner (
                id,
                description,
                entry_date
            )
        `)
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');

    if (error) {
        console.error("Fetch Error:", error);
        return;
    }

    const targets = entries.filter(e => {
        const d = e.accounting_entries?.description || "";
        return d.includes("(Automático)") || d.includes("(A Classificar)");
    });

    if (targets.length === 0) {
        console.log("No targets found.");
        return;
    }

    console.log(`Found ${targets.length} targets.`);
    targets.forEach(t => console.log(`[DELETE] ${t.accounting_entries.description} (${t.entry_id})`));

    const parentIds = [...new Set(targets.map(e => e.entry_id))];

    const { error: delError } = await supabase
        .from('accounting_entries')
        .delete()
        .in('id', parentIds);

    if (delError) {
        console.error("Delete Error:", delError);
    } else {
        console.log(`✅ Deleted ${parentIds.length} entries.`);
    }
}

finalNuke();
