
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function analyzeDiscrepancies() {
    console.log("=== Analisando Divergências de Janeiro ===");

    // 1. Get Account ID
    const { data: acc } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.1.05').single();
    const accountId = acc.id;

    // 2. Get DB Entries
    const { data: dbEntries } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id, 
            debit, 
            credit, 
            accounting_entries!inner (
                id,
                entry_date,
                description
            )
        `)
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');

    console.log(`Total DB entries: ${dbEntries.length}`);
    
    // Group by Description to find obvious duplicates
    const descMap = {};
    dbEntries.forEach(e => {
        const desc = e.accounting_entries.description;
        const val = (e.debit || 0) + (e.credit || 0); // Magnitude
        const key = `${desc}|${val}`;
        
        if (!descMap[key]) descMap[key] = 0;
        descMap[key]++;
    });

    console.log("\n--- Possíveis Duplicatas ( > 1 ocorrência) ---");
    Object.entries(descMap).forEach(([k, count]) => {
        if (count > 1) {
             console.log(`[x${count}] ${k}`);
        }
    });

    // Calculate sums again
    let totalDebit = 0;
    let totalCredit = 0;
    dbEntries.forEach(e => {
        totalDebit += Number(e.debit||0);
        totalCredit += Number(e.credit||0);
    });

    console.log(`\nDB Debit: ${totalDebit.toFixed(2)}`);
    console.log(`DB Credit: ${totalCredit.toFixed(2)}`);
}

analyzeDiscrepancies();
