
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const OUTFLOW_KEYWORDS = ['PAGAMENTO', 'DEBITO', 'TARIFA', 'SAQUE', 'ENVIO', 'LIQUIDACAO', 'APLIC.FINANCEIRA'];

async function fixInvertedSigns() {
    console.log('--- Fixing Inverted Signs (Feb/Mar 2025) ---');

    // 1. Fetch Candidates again to be sure
    const { data: txs, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', '2025-02-01')
        .lte('transaction_date', '2025-03-31')
        .gt('amount', 0); // Positive only

    if (error) {
        console.error(error);
        return;
    }

    const toUpdate = [];

    txs.forEach(tx => {
        const desc = tx.description.toUpperCase();
        const isOutflow = OUTFLOW_KEYWORDS.some(kw => desc.includes(kw));
        const isPixDeb = desc.includes('PIX_DEB');

        if (isOutflow || isPixDeb) {
            toUpdate.push(tx);
        }
    });

    console.log(`Found ${toUpdate.length} transactions to invert.`);

    if (toUpdate.length === 0) {
        console.log('Nothing to fix.');
        return;
    }

    // 2. Perform Updates
    let successCount = 0;
    let failCount = 0;

    for (const tx of toUpdate) {
        const newAmount = -Math.abs(tx.amount); // Ensure it's negative
        const { error: updateError } = await supabase
            .from('bank_transactions')
            .update({ amount: newAmount })
            .eq('id', tx.id);
        
        if (updateError) {
            console.error(`Failed to update ID ${tx.id}:`, updateError);
            failCount++;
        } else {
            successCount++;
        }
    }

    console.log(`\nOperation Complete.`);
    console.log(`Successfully inverted signs for ${successCount} transactions.`);
    console.log(`Failed: ${failCount}`);
}

fixInvertedSigns();
