
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function deploy() {
  console.log("🚀 Deploying DRE function via RPC...");
  
  const sqlPath = path.join(__dirname, 'create_dre_function.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const { data, error } = await supabase.rpc('exec_sql', { sql: sql });

  if (error) {
    console.error("❌ Error deploying function:", error);
    
    // Fallback: Check if the error is "function not found"
    if (error.code === 'PGRST202') {
      console.log("⚠️  Standard 'exec_sql' not found. Cannot deploy via RPC.");
    }
  } else {
    console.log("✅ Function deployed successfully!");
  }
}

deploy();
