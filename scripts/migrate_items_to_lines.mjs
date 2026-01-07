
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('Migrating from accounting_entry_items to accounting_entry_lines...');

    // 1. Fetch all items
    const { data: items, error: fetchError } = await supabase
        .from('accounting_entry_items')
        .select('*');

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        return;
    }

    if (items.length === 0) {
        console.log('No items to migrate.');
        return;
    }

    console.log(`Found ${items.length} items to migrate.`);

    // 2. Prepare payload for lines
    const lines = items.map(item => ({
        entry_id: item.entry_id,
        account_id: item.account_id,
        description: item.history || item.description, // Map 'history' to 'description'
        debit: item.debit,
        credit: item.credit,
        created_at: item.created_at
    }));

    // 3. Insert into lines
    const { error: insertError } = await supabase
        .from('accounting_entry_lines')
        .insert(lines);

    if (insertError) {
        console.error('Insert Lines Error:', insertError);
        return;
    }
    
    console.log('Successfully inserted into accounting_entry_lines.');

    // 4. Delete from items
    const ids = items.map(i => i.id);
    const { error: deleteError } = await supabase
        .from('accounting_entry_items')
        .delete()
        .in('id', ids);

    if (deleteError) {
        console.error('Delete Items Error:', deleteError);
    } else {
        console.log('Successfully cleaned up accounting_entry_items.');
    }
}

migrate();
