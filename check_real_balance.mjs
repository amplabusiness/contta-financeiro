
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Try .env.local first, then .env
let envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
    envPath = path.join(__dirname, '.env');
}

console.log(`Loading env from ${envPath}`);
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

// Simple manual parse to avoid dotenv dependency if not installed
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const anonKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const serviceKeyMatch = envContent.match(/SupabaseServiceRole=(.+)/) || envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch?.[1]?.trim();
// Prefer Service Role Key for Admin access (bypassing RLS)
const supabaseKey = serviceKeyMatch?.[1]?.trim() || anonKeyMatch?.[1]?.trim();

const isServiceKey = !!serviceKeyMatch?.[1];

if (!supabaseUrl || !supabaseKey) {
    console.error("Could not find Supabase credentials in .env.local or .env");
    process.exit(1);
}

console.log(`Key Type: ${isServiceKey ? 'SERVICE_ROLE (Admin)' : 'ANON (Public/RLS)'}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBankBalance() {
    console.log("Checking Bank Transactions (ANY)...");
    
    // Check count total
    const { count, error: countError } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true });
        
    console.log(`Total transactions in table: ${count}`);
    if (countError) console.error(countError);

    console.log("Checking JAN 2025 detailed...");
    const startDate = '2025-01-01';
    const endDate = '2025-01-31';

    const { data, error } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_date, description') 
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

    if (error) {
        // Try 'date' column if transaction_date fails? The schema usually uses transaction_date based on SuperConciliation.tsx
        console.error("Error fetching transactions:", error.message);
        
        // Retry with 'date' if the column name changed
        /*
        const { data: data2, error: error2 } = await supabase
        .from('bank_transactions')
        .select('amount, date')
        .gte('date', startDate)
        .lte('date', endDate);
        */
       return;
    }

    if (!data || data.length === 0) {
        console.log("No transactions found in Jan 2025.");
        return;
    }

    const sum = data.reduce((acc, tx) => acc + (tx.amount || 0), 0);
    const countJan = data.length;
    
    // Sort slightly to show first/last ??
    // Not needed for sum.

    console.log(`Found ${countJan} transactions in Jan.`);
    console.log(`Sum of amounts: ${sum.toFixed(2)}`);
    
    const startBalance = 90725.06;
    const finalBalance = startBalance + sum;
    
    console.log(`Starting Balance (Fixed): ${startBalance}`);
    console.log(`Calculated Final Balance: ${finalBalance.toFixed(2)}`);
}

checkBankBalance();
