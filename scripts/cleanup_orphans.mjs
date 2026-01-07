
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log('Checking for recent orphaned entries...');
    
    // Get entries created in the last 15 minutes
    const timeThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select(`
            id, 
            description, 
            created_at,
            accounting_entry_items (id)
        `)
        .eq('entry_type', 'MANUAL')
        .gt('created_at', timeThreshold);

    if (error) {
        console.error('Error fetching entries:', error);
        return;
    }

    const orphans = entries.filter(e => e.accounting_entry_items.length === 0);
    
    console.log(`Found ${entries.length} recent MANUAL entries.`);
    console.log(`Found ${orphans.length} orphans (no items).`);

    if (orphans.length > 0) {
        console.log('Deleting orphans...');
        const ids = orphans.map(e => e.id);
        
        const { error: delError } = await supabase
            .from('accounting_entries')
            .delete()
            .in('id', ids);
            
        if (delError) {
            console.error('Delete failed:', delError);
        } else {
            console.log('Successfully deleted orphans.');
        }
    } else {
        console.log('No orphans to clean.');
    }
}

cleanup();
