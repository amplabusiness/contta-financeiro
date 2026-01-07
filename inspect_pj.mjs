
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspectPJ() {
    const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .eq('contract_type', 'PJ');

    if (error) { console.error(error); return; }

    console.table(employees.map(e => ({
        name: e.name,
        official: e.official_salary,
        unofficial: e.unofficial_salary,
        description: e.description
    })));
}

inspectPJ();
