
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

async function inspectExtraTables() {
  console.log("🔍 INSPECTING ADDITIONAL REVENUE TABLES...\n");

  // 1. Company Services (Serviços Avulsos)
  const { data: services, error: errServ } = await supabase
      .from('company_services')
      .select('id, company_name, service_type, total_charged, payment_status, amount_received')
      .neq('payment_status', 'paid');
  
  if (errServ) console.log("❌ company_services error (maybe table incomplete):", errServ.message);
  else {
      console.log(`📊 Company Services (Pending): ${services.length}`);
      if(services.length > 0) console.table(services.slice(0, 5));
  }

  // 2. IRPF Declarations
  const { data: irpf, error: errIrpf } = await supabase
      .from('irpf_declarations')
      .select('*'); // Select * to see columns if unsure
      
  if (errIrpf) console.log("❌ irpf_declarations error:", errIrpf.message);
  else {
       // Filter manually for pending if needed, assuming 'status' column
       console.log(`📊 IRPF Declarations: ${irpf.length}`);
       if(irpf.length > 0) console.table(irpf.slice(0, 5));
  }

  // 3. Debt Confessions
  const { data: debts, error: errDebt } = await supabase
      .from('debt_confessions')
      .select('id, client_id, total_debt, status, created_at');
      
  if (errDebt) console.log("❌ debt_confessions error:", errDebt.message);
  else {
      console.log(`📊 Debt Confessions: ${debts.length}`);
      if(debts.length > 0) console.table(debts);
  }
}

inspectExtraTables();
