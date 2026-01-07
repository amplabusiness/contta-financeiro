
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspectBankTxSystem() {
    console.log("=== Inspecting Bank Transactions for System Patterns ===");

    const { data: txs, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', '2025-02-01')
        .lte('transaction_date', '2025-03-31');

    if (txs) {
        console.log(`Total Tx Feb/Mar: ${txs.length}`);
        
        // Check for duplicates (same description, same amount, same date)
        const map = new Map();
        const duplicates = [];
        
        txs.forEach(tx => {
            const key = `${tx.transaction_date}|${tx.amount}|${tx.description}`;
            if (map.has(key)) {
                duplicates.push(tx);
            } else {
                map.set(key, true);
            }
        });

        console.log(`Potential Duplicates (Same Date/Amount/Desc): ${duplicates.length}`);
        if(duplicates.length > 0) {
            console.log("Samples of duplicates:");
            duplicates.slice(0, 5).forEach(d => console.log(` - ${d.transaction_date}: ${d.description} (${d.amount})`));
        }

        // Check for Suspicious descriptions
        const suspicious = txs.filter(tx => 
            tx.description.toLowerCase().includes('provision') || 
            tx.description.toLowerCase().includes('estimativa') ||
            tx.description.toLowerCase().includes('automático')
        );
        console.log(`Suspicious Keywords found: ${suspicious.length}`);
    }
}

inspectBankTxSystem();
