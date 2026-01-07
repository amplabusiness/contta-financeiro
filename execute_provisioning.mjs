
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


async function runProvisioning() {
    const startDate = new Date('2025-01-01T12:00:00Z'); // Use noon to avoid timezone skipping
    const endDate = new Date('2026-01-01T12:00:00Z'); 
    
    let currentDate = startDate;

    console.log(`🤖 Dr. Cicero: Starting Batch Provisioning from 01/2025 to 01/2026...`);

    while (currentDate <= endDate) {
        const competence = currentDate.toISOString().split('T')[0];
        console.log(`\n📅 Processing Competence: ${competence}...`);

        const { data, error } = await supabase.rpc('generate_monthly_fees', {
            p_competence_date: competence,
            p_due_day: 10, // Vencimento dia 10 do mês seguinte
            p_simulate: false
        });

        if (error) {
            console.error(`❌ Error for ${competence}:`, error.message);
        } else {
            console.log(`✅ Provisioning Complete for ${competence}`);
            
            // Count statuses
            const stats = {};
            if (data && data.length > 0) {
                data.forEach(d => {
                    const status = d.result_status;
                    stats[status] = (stats[status] || 0) + 1;
                });
                console.table(stats);
            } else {
                console.log("   No clients processed (Empty return).");
            }
        }

        // Advance 1 month
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    console.log("\n🏁 All months processed.");
}

runProvisioning();
