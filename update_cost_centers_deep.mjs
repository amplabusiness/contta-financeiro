
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// COST CENTER IDs
const CC = {
    DP: 'dff8e3e6-9f67-4908-a715-aeafe7715458', // 1.1 AMPLA.DP
    FISCAL: '97ebef26-92fd-4db0-bd9f-7acb63880c97', // 1.2 AMPLA.FISCAL
    CONTABIL: '67f8112d-a934-40c8-99bb-57630e29bc62', // 1.3 AMPLA.CONTABIL
    LEGALIZACAO: '3148dccf-4458-4d63-a152-c813097ce1e9', // 1.4 AMPLA.LEGALIZACAO
    ADMINISTRATIVO: '9ebaef20-e25d-40b3-97bf-f44b1499a3e4', // 1.5 AMPLA.ADMINISTRATIVO
    FINANCEIRO: '1dad2281-a86f-463b-b73b-4ec7f41492ec', // 1.6 AMPLA.FINANCEIRO
    
    // FAMILY / PARTNERS (User Request: "Sergio Augusto [...] centro de custo filho sergio")
    FILHO_SERGIO: '5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d', // Correct ID: Sergio Augusto (Filho)
    SOCIOS_GERAL: '40d9d6ae-6b72-4744-a400-a29dc3b71b55' // 3. SERGIO
};

const MAPPINGS = [
    // --- SERGIO AUGUSTO (Specific Request) ---
    { pattern: 'SERGIO AUGUSTO', cc_id: CC.FILHO_SERGIO, desc: 'Filho Sergio' },

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
    console.log("🚀 Starting DB Update for Cost Centers (Looking deeply in Entry Descriptions)...");
    
    let totalUpdated = 0;

    // We can't easily filter by joined column in 'select', so we have to use the 'contains' trick or just scan heavily.
    // However, Supabase (PostgREST) supports filtering on joined resource with !inner to filter the parent rows that match.
    // select('*, accounting_entries!inner(*)')
    
    for (const map of MAPPINGS) {
        
        // Strategy: Find Lines where the linked Entry has the keyword in description
        const { data: lines, error: searchError } = await supabase
            .from('accounting_entry_lines')
            .select(`
                id,
                entry:accounting_entries!inner(description)
            `)
            .ilike('accounting_entries.description', `%${map.pattern}%`); 
            // Note: PostgREST syntax for filtering on joined table is usually table.column

        if (searchError) {
             console.error(`Error searching ${map.pattern}:`, searchError);
             continue;
        }

        if (lines && lines.length > 0) {
            const ids = lines.map(l => l.id);
            console.log(`Found ${lines.length} items for ${map.desc} (${map.pattern}). Updating...`);

            // Apply Update
            // We update ALL matching lines found.
            // CAREFUL: This might overwrite if multiple patterns match. Order matters (most specific first).
            // But for now, specificity is okay.
            
            const { error: updateError } = await supabase
                .from('accounting_entry_lines')
                .update({ cost_center_id: map.cc_id })
                .in('id', ids);

            if (updateError) {
                console.error(`Error updating:`, updateError);
            } else {
                console.log(`✅ Updated ${lines.length} lines.`);
                totalUpdated += lines.length;
            }
        } else {
            // Fallback: Check Line Description too
            const { data: lines2 } = await supabase
                .from('accounting_entry_lines')
                .select('id')
                .ilike('description', `%${map.pattern}%`);
                
            if (lines2 && lines2.length > 0) {
                const ids2 = lines2.map(l => l.id);
                console.log(`Found ${lines2.length} items (via Line Desc) for ${map.desc}. Updating...`);
                await supabase.from('accounting_entry_lines').update({ cost_center_id: map.cc_id }).in('id', ids2);
                totalUpdated += lines2.length;
            }
        }
    }
    console.log(`\n🎉 DONE. Total Updates: ${totalUpdated}`);
}

updateDB();
