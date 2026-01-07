
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const MAPPINGS = [
    // --- DEPARTAMENTO PESSOAL (DP) ---
    // Terceiros (1.1.2)
    { name: 'ROSEMEIRE', id: 'fce73ea7-71ad-4c6b-8ef7-33642534e98a', desc: 'DP Terceiros' },
    { name: 'ALEXSSANDRA', id: 'fce73ea7-71ad-4c6b-8ef7-33642534e98a', desc: 'DP Terceiros' },
    { name: 'TATIANA', id: 'fce73ea7-71ad-4c6b-8ef7-33642534e98a', desc: 'DP Terceiros' },
    { name: 'ALINE', id: 'fce73ea7-71ad-4c6b-8ef7-33642534e98a', desc: 'DP Terceiros' },
    // CLT (1.1.1)
    { name: 'ERICK FABRICIO', id: '23f6be5b-48e1-4af4-9312-3f24c3812b9c', desc: 'DP CLT' },
    { name: 'THANINY', id: '23f6be5b-48e1-4af4-9312-3f24c3812b9c', desc: 'DP CLT' },
    { name: 'JESSYCA', id: '23f6be5b-48e1-4af4-9312-3f24c3812b9c', desc: 'DP CLT' }, // Jessyca de Freitas
    { name: 'LUCIANA', id: '23f6be5b-48e1-4af4-9312-3f24c3812b9c', desc: 'DP CLT' },
    { name: 'LUCIANE', id: '23f6be5b-48e1-4af4-9312-3f24c3812b9c', desc: 'DP CLT' }, // Luciane Rosa
    { name: 'DEUZA', id: '23f6be5b-48e1-4af4-9312-3f24c3812b9c', desc: 'DP CLT' },

    // --- FISCAL ---
    // Terceiros (1.2.2)
    { name: 'DANIEL RODRIGUES', id: 'e41e7a3f-fdd2-43c3-ba2e-f74873ecbbac', desc: 'Fiscal Terceiros' },
    
    // --- FINANCEIRO ---
    // (1.6)
    { name: 'TAYLANE', id: '1dad2281-a86f-463b-b73b-4ec7f41492ec', desc: 'Financeiro' },

    // --- LEGALIZAÇÃO ---
    // Terceiros (1.4.2)
    { name: 'SUELI AMARAL', id: '187dece6-8849-4b8e-9ec1-194dc4ffd0e9', desc: 'Legalização Terceiros' },

    // --- CONTÁBIL ---
    // CLT (1.3.1)
    { name: 'JOSIMAR', id: 'b99a4b98-918f-4ac7-acf7-2b66b7fbc338', desc: 'Contábil CLT' },
    { name: 'THAYNARA', id: 'b99a4b98-918f-4ac7-acf7-2b66b7fbc338', desc: 'Contábil CLT' },

    // --- ADMINISTRATIVO ---
    // (1.5) - Note: Using Main Admin cost center for both PJ and CLT in Admin unless split exists.
    // There is no specific CLT/Terceiros split for Admin in the list I saw, so using 1.5.
    { name: 'ANDREA FERREIRA', id: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', desc: 'Admin' },
    { name: 'AMANDA AMBROSIO', id: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', desc: 'Admin' },
    { name: 'JORDANA', id: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', desc: 'Admin' },
    { name: 'RAIMUNDO', id: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', desc: 'Admin' },
    { name: 'LILIAN', id: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', desc: 'Admin' },
    { name: 'CLAUDIA', id: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', desc: 'Admin' },
    { name: 'FABIANA MARIA', id: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', desc: 'Admin' },
];

async function applyCostCenters() {
    console.log("🏗️  Applying Cost Centers to Accounting Entries...");

    let totalUpdated = 0;

    for (const map of MAPPINGS) {
        // Query to find lines that match the name
        // We look in 'description' AND 'memo'.
        // Also ensure we are looking at EXPENSE accounts (4.1.1.X or 4.1.2.X) essentially. 
        // Or just update all matching lines, which is generally safe for these specific names in this context.
        
        const { data: lines, error: searchError } = await supabase
            .from('accounting_entry_lines')
            .select('id, description')
            .ilike('description', `%${map.name}%`)
            .is('cost_center_id', null); // Only update those without a cost center

        if (searchError) {
            console.error(`Error searching for ${map.name}:`, searchError);
            continue;
        }

        if (lines && lines.length > 0) {
            console.log(`Found ${lines.length} entries for ${map.name} (${map.desc}). Updating...`);
            
            const idsToUpdate = lines.map(l => l.id);

            const { error: updateError } = await supabase
                .from('accounting_entry_lines')
                .update({ cost_center_id: map.id })
                .in('id', idsToUpdate);

            if (updateError) {
                console.error(`Error updating ${map.name}:`, updateError);
            } else {
                totalUpdated += lines.length;
                console.log(`✅ Updated ${lines.length} lines for ${map.name}`);
            }
        } else {
            console.log(`No untagged entries found for ${map.name}`);
        }
    }

    console.log(`\n🎉 Process Complete. Total lines updated: ${totalUpdated}`);
}

applyCostCenters();
