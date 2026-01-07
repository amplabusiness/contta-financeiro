
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspectMajorInflows() {
    console.log('--- Inspecting Major Inflows for Feb/Mar 2025 ---');

    // Fetch all transactions for Feb/Mar 2025
    const { data: txs, error } = await supabase
        .from('bank_transactions')
        .select('id, transaction_date, description, amount, fitid')
        .gte('transaction_date', '2025-02-01')
        .lte('transaction_date', '2025-03-31')
        .gt('amount', 0) // Only inflows
        .order('amount', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }

    console.log(`Top 20 Inflows in Feb/Mar 2025:`);
    txs.forEach(tx => {
        console.log(`${tx.transaction_date} | ${parseFloat(tx.amount).toFixed(2).padStart(12)} | ${tx.description.substring(0, 50)} | ${tx.fitid}`);
    });

    // Check for potential duplicates (same date, same amount, same description) in Feb/Mar
    console.log('\n--- Checking for Content Duplicates (ignoring fitid) ---');
     const { data: allTxs } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', '2025-02-01')
        .lte('transaction_date', '2025-03-31');

    const groups = {};
    let dupesFound = 0;

    allTxs.forEach(tx => {
        const key = `${tx.transaction_date}|${tx.amount}|${tx.description.trim()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(tx);
    });

    Object.keys(groups).forEach(key => {
        if (groups[key].length > 1) {
            dupesFound++;
            const first = groups[key][0];
            console.log(`DUPLICATE GROUP (${groups[key].length}x): ${first.transaction_date} | ${first.amount} | ${first.description.substring(0, 30)}`);
             groups[key].forEach(g => console.log(`   - ID: ${g.id} FITID: ${g.fitid}`));
        }
    });

    if (dupesFound === 0) {
        console.log('No content-based duplicates found in Feb/Mar.');
    } else {
        console.log(`\nFound ${dupesFound} groups of duplicates.`);
    }
}

inspectMajorInflows();
