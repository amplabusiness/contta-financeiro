
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkTotals() {
    const accountId = '10d5892d-a843-4034-8d62-9fec95b8fd56'; // Sicredi

    // Fetch all items for this account
    const { data: items, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            debit, 
            credit, 
            accounting_entries!inner(entry_date)
        `)
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');

    if (error) {
        console.error('Error:', error);
        return;
    }

    let totalDebit = 0;
    let totalCredit = 0;
    let count = 0;

    for (const item of items) {
        totalDebit += Number(item.debit);
        totalCredit += Number(item.credit);
        count++;
    }

    console.log(`Transactions: ${count}`);
    console.log(`Total Debit (Inflow):  ${totalDebit.toFixed(2)}`);
    console.log(`Total Credit (Outflow): ${totalCredit.toFixed(2)}`);
    console.log(`Net Move: ${(totalDebit - totalCredit).toFixed(2)}`);
}

checkTotals();
