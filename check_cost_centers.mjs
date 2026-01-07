import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkCostCenters() {
    console.log('🔎 Checking Cost Centers...');
    const { data: centers, error } = await supabase.from('cost_centers').select('id, name, code');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.table(centers);
}

checkCostCenters();
