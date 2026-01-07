
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function analyzeLargeManualDebits() {
    console.log('🔍 Analisando grandes débitos manuais recentes...');
    
    // Get entries created in the last 24 hours (MANUAL import)
    const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select(`
            id, 
            entry_date, 
            description, 
            total_debit
        `)
        .eq('entry_type', 'MANUAL')
        .gt('created_at', timeThreshold)
        .gt('total_debit', 0) // Only debits
        .order('total_debit', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Top ${entries.length} Maiores Débitos Manuais Importados:`);
    entries.forEach(e => {
        console.log(`[${e.entry_date}] R$ ${e.total_debit.toFixed(2)} - ${e.description}`);
    });
}

analyzeLargeManualDebits();
