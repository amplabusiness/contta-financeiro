
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

async function simulateProvisioning() {
    // Test Jan 2025 and Jan 2026
    const dates = ['2025-01-01', '2026-01-01'];

    for (const date of dates) {
        console.log(`\n🤖 Simulating Provisioning for: ${date}...`);
        
        const { data, error } = await supabase.rpc('generate_monthly_fees', {
            p_competence_date: date,
            p_due_day: 10,
            p_simulate: true // Enable simulation mode
        });

        if (error) {
            console.error(`❌ Error:`, error.message);
        } else {
            console.log(`✅ Simulation Results: ${data.length} VALID contracts processed`);
            
            // Check actual invoice count
            const { count, error: countError } = await supabase
                .from('invoices')
                .select('*', { count: 'exact', head: true })
                .eq('competence', '01/' + date.split('-')[0]) // 01/2025
                .eq('type', 'honorario_mensal');
            
            if (!countError) {
                console.log(`📊 Actual Invoices in DB for ${date.split('-')[0]}: ${count}`);
                if (count > data.length) {
                    console.log(`⚠️ WARNING: There are ${count - data.length} invoices that might be invalid (contract not started or ended).`);
                } else if (count < data.length) {
                    console.log(`ℹ️ Info: There are based ${data.length - count} missing invoices that would be created.`);
                } else {
                    console.log(`✨ Match: Number of valid contracts matches number of invoices.`);
                }
            }

            // Show a sample of results
            const sample = data.filter(d => d.result_status.includes('Create') || d.result_status.includes('CREATED') || d.result_status.includes('SIMULATED')).slice(0, 5);

            if (sample.length > 0) {
                console.table(sample);
            } else {
                console.log("No new invoices would be created (all skipped or none found).");
                const skipped = data.filter(d => d.result_status.includes('SKIPPED')).slice(0, 3);
                 if (skipped.length > 0) {
                    console.log("Sample skipped:");
                    console.table(skipped);
                }
            }
        }
    }
}

simulateProvisioning();
