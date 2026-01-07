
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspectTables() {
    // Try to select from 'employees'
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error accessing 'employees':", error.message);
        
        // Try 'funcionarios' just in case
        const { data: data2, error: error2 } = await supabase
            .from('funcionarios')
            .select('*')
            .limit(1);
            
        if (error2) console.error("Error accessing 'funcionarios':", error2.message);
        else {
            console.log("Table 'funcionarios' exists. Keys:", Object.keys(data2[0] || {}));
        }
    } else {
        console.log("Table 'employees' exists. Keys:", Object.keys(data[0] || {}));
    }
}

inspectTables();
