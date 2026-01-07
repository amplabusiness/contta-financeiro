
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const CLIENTS_ACC_ID = '12cb93f6-daef-4e2d-bfa9-db9850fdc781'; // 1.1.2.01
const LOANS_ACC_ID = '815bd89d-c13b-4538-8e6c-289162b2e464';   // 2.1.4.03 Empréstimos de Sócios

async function fixOrphans() {
  console.log("🛠️  Reclassifying Orphan Receipts...");

  // 1. Find the lines to update
  // Since we can't join in an UPDATE via Supabase client easily, we fetch IDs first.
  
  const { data: orphansRaw, error: findError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      entry_id,
      credit,
      accounting_entries!inner (
        id,
        invoice_id,
        entry_type
      )
    `)
    .eq('account_id', CLIENTS_ACC_ID)
    .gt('credit', 0); // Only Credits (Payments)

  if (findError) {
    console.error("Error finding orphans:", findError);
    return;
  }
  
  if (orphansRaw.length > 0) {
      console.log("First 5 raw rows:");
      console.log(JSON.stringify(orphansRaw.slice(0, 5), null, 2));
  } else {
      console.log("No raw rows found for this account ID.");
  }

  // Filter in JS to be safe
  const orphans = orphansRaw.filter(o => {
    // Check strict null or undefined
    const isOrphan = !o.accounting_entries.invoice_id; 
    const isReceipt = o.accounting_entries.entry_type === 'recebimento'; // Was 'receipt'
    return isOrphan && isReceipt;
  });

  console.log(`Found ${orphans.length} orphan receipts to reclassify.`);
  if (orphans.length === 0) return;

  const totalValue = orphans.reduce((sum, item) => sum + Number(item.credit), 0);
  console.log(`Total Value to Move: ${totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);

  // 2. Update them
  const lineIds = orphans.map(o => o.id);
  
  // Update in batches of 100 just in case
  const batchSize = 100;
  for (let i = 0; i < lineIds.length; i += batchSize) {
    const batch = lineIds.slice(i, i + batchSize);
    const { error: updateError } = await supabase
      .from('accounting_entry_lines')
      .update({ account_id: LOANS_ACC_ID })
      .in('id', batch);

    if (updateError) {
      console.error(`Error updating batch ${i}:`, updateError);
    } else {
      console.log(`✅ Reclassified batch ${i} - ${i + batch.length}`);
    }
  }

  console.log("🎉 Reclassification Complete.");
}

fixOrphans();
