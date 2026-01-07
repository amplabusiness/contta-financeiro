
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function regenerate2026() {
    console.log("🧹 Cleaning up 2026 invoices to apply new logic...");
    
    // 1. Get IDs of invoices to delete
    const { data: invoices, error: fetchError } = await supabase
        .from('invoices')
        .select('id')
        .eq('competence', '01/2026');
        
    if (fetchError) {
        console.error("❌ Error fetching invoices:", fetchError);
        return;
    }
    
    const invoiceIds = invoices.map(i => i.id);
    console.log(`Found ${invoiceIds.length} invoices to remove.`);

    if (invoiceIds.length > 0) {
        // 2. Delete dependent accounting_entries
        const { error: entriesError } = await supabase
            .from('accounting_entries')
            .delete()
            .in('invoice_id', invoiceIds);
            
        if (entriesError) {
            console.error("❌ Error deleting accounting entries:", entriesError);
            return;
        }
        console.log("✅ Dependent accounting entries deleted.");

        // 3. Delete Invoices
        const { error: delError } = await supabase
            .from('invoices')
            .delete()
            .in('id', invoiceIds);
            
        if (delError) {
            console.error("❌ Error deleting 2026 invoices:", delError);
            return;
        }
        console.log("✅ 2026 Invoices deleted.");
    }

    console.log("🚀 Generating 2026 Invoices with Contract Dates & Minimum Wage logic...");
    
    const { data, error } = await supabase.rpc('generate_monthly_fees', {
        p_competence_date: '2026-01-01',
        p_due_day: 10,
        p_simulate: false
    });

    if (error) {
        console.error("❌ Error generating:", error);
    } else {
        const created = data.filter(d => d.result_status === 'CREATED').length;
        console.log(`✅ Generation Complete. Created ${created} invoices.`);
        
        // Show sample of values to confirm logic
        const sample = data.filter(d => d.result_status === 'CREATED').slice(0, 5);
        if (sample.length > 0) {
            console.log("\nSample Generated (Client | Fee):");
            console.table(sample);
            
            // Check if any used the Minimum Wage logic (fee differed from monthly_fee?)
            // We can't see the original monthly_fee here easily without querying contract again, 
            // but we can trust the log.
        }
    }
}

regenerate2026();
