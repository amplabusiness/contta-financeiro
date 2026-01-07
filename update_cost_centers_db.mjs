
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// COST CENTER IDs (From check_cost_centers.mjs)
const CC = {
    DP: 'dff8e3e6-9f67-4908-a715-aeafe7715458', // 1.1 AMPLA.DP
    FISCAL: '97ebef26-92fd-4db0-bd9f-7acb63880c97', // 1.2 AMPLA.FISCAL
    CONTABIL: '67f8112d-a934-40c8-99bb-57630e29bc62', // 1.3 AMPLA.CONTABIL
    LEGALIZACAO: '3148dccf-4458-4d63-a152-c813097ce1e9', // 1.4 AMPLA.LEGALIZACAO
    ADMINISTRATIVO: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', // 1.5 AMPLA.ADMINISTRATIVO
    FINANCEIRO: '1dad2281-a86f-463b-b73b-4ec7f41492ec', // 1.6 AMPLA.FINANCEIRO
    
    // FAMILY / PARTNERS (User Request: "Sergio Augusto [...] centro de custo filho sergio")
    FILHO_SERGIO: '4f4bc9e4-a834-45f1-ba82-a31dab4a77b8', // ID 4: 'Sergio Augusto (Filho)' / '3.1.3 SERGIO.FILHOS.SERGIO_AUGUSTO' 
    // note: ID 4 name was 'AMPLA.ENERGIA' in one view? let me check log again.
    // Wait! 
    // ID 0: '4f4bc9e4...' -> 'AMPLA.ENERGIA'
    // ID 4: '5b8a1d97... -> 'Sergio Augusto (Filho)' - '3.1.3 SERGIO.FILHOS.SERGIO_AUGUSTO'
    // Correct ID is '5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d'
    
    SOCIOS_GERAL: '40d9d6ae-6b72-4744-a400-a29dc3b71b55' // 3. SERGIO or similar
};

const MAPPINGS = [
    // --- SERGIO AUGUSTO (Specific Request) ---
    { pattern: 'SERGIO AUGUSTO', cc_id: '5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d', desc: 'Filho Sergio' },

    // --- DP ---
    { pattern: 'ROSEMEIRE', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'ALEXSSANDRA', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'TATIANA', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'ALINE', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'ERICK FABRICIO', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'THANINY', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'JESSYCA', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'LUCIANA', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'LUCIANE', cc_id: CC.DP, desc: 'DP' },
    { pattern: 'DEUZA', cc_id: CC.DP, desc: 'DP' },

    // --- FISCAL ---
    { pattern: 'DANIEL RODRIGUES', cc_id: CC.FISCAL, desc: 'Fiscal' },

    // --- FINANCEIRO ---
    { pattern: 'TAYLANE', cc_id: CC.FINANCEIRO, desc: 'Financeiro' },

    // --- LEGALIZACAO ---
    { pattern: 'SUELI AMARAL', cc_id: CC.LEGALIZACAO, desc: 'Legalizacao' },

    // --- CONTABIL ---
    { pattern: 'JOSIMAR', cc_id: CC.CONTABIL, desc: 'Contabil' },
    { pattern: 'THAYNARA', cc_id: CC.CONTABIL, desc: 'Contabil' },

    // --- ADM ---
    { pattern: 'ANDREA FERREIRA', cc_id: CC.ADMINISTRATIVO, desc: 'Adm' },
    { pattern: 'AMANDA AMBROSIO', cc_id: CC.ADMINISTRATIVO, desc: 'Adm' },
    { pattern: 'JORDANA', cc_id: CC.ADMINISTRATIVO, desc: 'Adm' },
    { pattern: 'RAIMUNDO', cc_id: CC.ADMINISTRATIVO, desc: 'Adm' },
    { pattern: 'LILIAN', cc_id: CC.ADMINISTRATIVO, desc: 'Adm' },
    { pattern: 'CLAUDIA', cc_id: CC.ADMINISTRATIVO, desc: 'Adm' },
    { pattern: 'FABIANA MARIA', cc_id: CC.ADMINISTRATIVO, desc: 'Adm' },
];

async function updateDB() {
    console.log("🚀 Starting DB Update for Cost Centers (Vertical DRE Params)...");
    
    let total = 0;

    for (const map of MAPPINGS) {
        // Find lines
        const { data: lines, error: searchError } = await supabase
            .from('accounting_entry_lines')
            .select('id, description')
            .ilike('description', `%${map.pattern}%`);

        if (searchError) {
             // If column missing, this might actually fail on select? No, select is checking description.
             console.error(`Error searching ${map.pattern}:`, searchError);
             continue;
        }

        if (lines && lines.length > 0) {
            const ids = lines.map(l => l.id);
            console.log(`Found ${lines.length} items for ${map.desc} (${map.pattern}). Updating...`);

            const { error: updateError } = await supabase
                .from('accounting_entry_lines')
                .update({ cost_center_id: map.cc_id })
                .in('id', ids);

            if (updateError) {
                if (updateError.code === '42703') {
                    console.error("❌ CRITICAL: Column 'cost_center_id' does not exist. Please run the SQL migration first!");
                    return; // Stop execution
                }
                console.error(`Error updating:`, updateError);
            } else {
                console.log(`✅ Updated ${lines.length} lines.`);
                total += lines.length;
            }
        }
    }
    console.log(`\n🎉 DONE. Total Updates: ${total}`);
}

updateDB();
