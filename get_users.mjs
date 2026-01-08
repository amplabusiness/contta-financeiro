
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) envPath = path.join(__dirname, '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const anonKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const serviceKeyMatch = envContent.match(/SupabaseServiceRole=(.+)/) || envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch?.[1]?.trim();
// Must use service key to list users from auth
const supabaseKey = serviceKeyMatch?.[1]?.trim() || anonKeyMatch?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Try to get from public.users first if it exists (common pattern)
    // or auth.users
    
    console.log("Checking auth.users...");
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
        console.error("Error listing auth users:", error.message);
        // Try selecting from a public table if auth fails (maybe using anon key?)
        console.log("Checking public.profiles...");
        const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(5);
        if (pError) console.error("Error listing profiles:", pError.message);
        else console.log("Profiles:", profiles);
    } else {
        console.log("Auth Users found:", users.length);
        if (users.length > 0) {
            console.log("First User ID:", users[0].id);
            console.log("First User Email:", users[0].email);
        }
    }
}

run();
