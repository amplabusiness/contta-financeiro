
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function verifyBalances() {
    console.log('--- Verifying Final Balances (Structure Check) ---');

    // 1. Get Jan 2025 Net
    const { data: janTx } = await supabase.rpc('get_monthly_net', { start_date: '2025-01-01', end_date: '2025-01-31' }); 
    // RPC might not exist or be convenient. Let's just use raw sum.
    
    // Helper function
    async function getSum(start, end) {
        const { data } = await supabase
            .from('bank_transactions')
            .select('amount')
            .gte('transaction_date', start)
            .lte('transaction_date', end);
        return data.reduce((acc, curr) => acc + curr.amount, 0);
    }

    const janNet = await getSum('2025-01-01', '2025-01-31');
    const febNet = await getSum('2025-02-01', '2025-02-28');
    const marNet = await getSum('2025-03-01', '2025-03-31');

    // We know Jan Closing was ~18k. 
    // We don't know Opening Jan precisely here without looking up opening_balance entries, 
    // but we can infer the progression.
    
    // Actually, let's just show the Net Movements now that signs are fixed.
    console.log(`Jan 2025 Net Movement: R$ ${janNet.toFixed(2)}`);
    console.log(`Feb 2025 Net Movement: R$ ${febNet.toFixed(2)}`);
    console.log(`Mar 2025 Net Movement: R$ ${marNet.toFixed(2)}`);

    // Hypothetical Progression (Assuming Dec 31 was what made Jan close at 18k)
    // If Jan Closing = 18.553,54
    const janClosing = 18553.54;
    const febClosing = janClosing + febNet;
    const marClosing = febClosing + marNet;

    console.log(`\n--- Projected Balances (Based on Jan Closing = R$ 18.553,54) ---`);
    console.log(`Jan 31: R$ ${janClosing.toLocaleString('pt-BR')}`);
    console.log(`Feb 28: R$ ${febClosing.toLocaleString('pt-BR')} (Prev: ~380k)`);
    console.log(`Mar 31: R$ ${marClosing.toLocaleString('pt-BR')} (Prev: ~1M)`);
}

verifyBalances();
