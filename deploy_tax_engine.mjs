
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployTaxProjections() {
  console.log("🚀 Deploying Tax Engine & Projections...");

  const filePath = path.join('supabase', 'migrations', '20260107020000_tax_projections.sql');
  const sql = fs.readFileSync(filePath, 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
     console.log("⚠️ RPC exec_sql not available. Please run the SQL manually in Supabase SQL Editor.");
     console.log(`File: ${filePath}`);
     
     // Fallback: Try a select to see if table exists (implies it might have been run)
     const { error: checkError } = await supabase.from('tax_configurations').select('id').limit(1);
     if (!checkError) {
         console.log("✅ Tables seem to exist already.");
     } else {
         console.log("❌ Migration needs to be applied.");
     }
  } else {
     console.log("✅ Migration executed successfully via RPC!");
  }
}

deployTaxProjections();
