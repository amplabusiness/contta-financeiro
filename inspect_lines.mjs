
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchema() {
    const { data, error } = await supabase
        .from('accounting_entry_lines')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }
    console.log("Keys in accounting_entry_lines:", Object.keys(data[0]));
}

inspectSchema();
