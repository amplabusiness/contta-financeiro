
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkBankTxFebMar() {
    console.log("=== Checking Bank Transactions (Feb/Mar 2025) ===");

    // Feb
    const { data: feb, error: errFeb } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', '2025-02-01')
        .lte('transaction_date', '2025-02-28');
    
    if (feb) {
        console.log(`\nFEB 2025: Found ${feb.length} transactions.`);
        const sumFeb = feb.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
        console.log(`Net Sum Feb: ${sumFeb.toFixed(2)}`);
        if (feb.length > 0) {
            console.log("Samples:");
            feb.slice(0, 3).forEach(t => console.log(` - [${t.transaction_date}] ${t.description} (${t.amount})`));
        }
    }

    // Mar
    const { data: mar, error: errMar } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', '2025-03-01')
        .lte('transaction_date', '2025-03-31');

    if (mar) {
        console.log(`\nMAR 2025: Found ${mar.length} transactions.`);
        const sumMar = mar.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
        console.log(`Net Sum Mar: ${sumMar.toFixed(2)}`);
        if (mar.length > 0) {
            console.log("Samples:");
            mar.slice(0, 3).forEach(t => console.log(` - [${t.transaction_date}] ${t.description} (${t.amount})`));
        }
    }
}

checkBankTxFebMar();
