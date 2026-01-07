
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificAmount() {
    const amount = 18257.04;
    console.log(`Searching for entries with value around ${amount}...`);

    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            debit, credit, description, created_at,
            accounting_entries (entry_date, description, entry_type)
        `)
        .or(`debit.eq.${amount},credit.eq.${amount}`);

    if (error) console.error(error);
    else console.log(JSON.stringify(lines, null, 2));
}

checkSpecificAmount();
