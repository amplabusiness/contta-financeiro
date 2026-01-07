
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const CC_AMPLA_SAUDE = 'e84d8dd4-7ca8-4a3a-8390-e6487e54f20c';

async function analyzeAccounts() {
    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            account_id,
            debit,
            credit,
            account:chart_of_accounts(name, code)
        `)
        .eq('cost_center_id', CC_AMPLA_SAUDE);

    if (error) {
        console.error(error);
        return;
    }

    const accountSummary = {};

    lines.forEach(l => {
        const name = l.account?.name || 'Unknown';
        if (!accountSummary[name]) {
            accountSummary[name] = { debit: 0, credit: 0, count: 0 };
        }
        accountSummary[name].debit += Number(l.debit || 0);
        accountSummary[name].credit += Number(l.credit || 0);
        accountSummary[name].count++;
    });

    console.table(accountSummary);
}

analyzeAccounts();
