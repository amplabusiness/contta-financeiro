
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectContracts() {
  console.log("🔍 INSPECTING CONTRACTS & CLIENTS...\n");

  // 1. Clients with Monthly Fees
  const { data: clients, error: errCli } = await supabase
      .from('clients')
      .select('id, name, monthly_fee')
      .gt('monthly_fee', 0);
  
  if (errCli) console.log("❌ clients error:", errCli.message);
  else {
      console.log(`📊 Clients with Monthly Fee > 0: ${clients.length}`);
      const totalMonthly = clients.reduce((sum, c) => sum + Number(c.monthly_fee), 0);
      console.log(`💰 Total Monthly Potential: R$ ${totalMonthly.toFixed(2)}`);
  }

  // 2. Accounting Contracts
  const { data: contracts, error: errCon } = await supabase
      .from('accounting_contracts')
      .select('*');
      
  if (errCon) console.log("❌ accounting_contracts error (table might not exist yet):", errCon.message);
  else {
      console.log(`📊 Accounting Contracts: ${contracts.length}`);
      if(contracts.length > 0) console.table(contracts.slice(0, 3));
  }
}

inspectContracts();
