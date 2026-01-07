
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) process.exit(1);

const supabase = createClient(supabaseUrl, supabaseKey);

// CONFIG
// Debit: Clientes a Receber Check Account ID from previous run: 12cb93f6-daef-4e2d-bfa9-db9850fdc781
const DEBIT_ACCOUNT_ID = '12cb93f6-daef-4e2d-bfa9-db9850fdc781'; // 1.1.2.01
// Credit: Saldo de Abertura - Clientes : 5.3.02.02
const CREDIT_ACCOUNT_ID_CANDIDATE = 'be15a798-3caa-489e-8b7c-af6b7a51385f'; 

const SYSTEM_START_DATE = '2025-01-01';

async function fixOpeningAccounting() {
  console.log("🛠️  FIX: Generating Missing Accounting Entries for Opening Balances...\n");

  // 1. Verify Credit Account
  const { data: creditAcc } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('id', CREDIT_ACCOUNT_ID_CANDIDATE)
    .single();

  if (!creditAcc) {
      console.error("❌ Credit Account not found by ID. Aborting to be safe.");
      return;
  }
  console.log(`✅ Using Credit Account: ${creditAcc.code} - ${creditAcc.name}`);

  // 2. Fetch PENDING Pre-2025 Balances
  const { data: balances, error: balError } = await supabase
    .from('client_opening_balance')
    .select(`
      id,
      client_id,
      amount,
      competence,
      description,
      clients (name)
    `)
    .eq('status', 'pending');

  if (balError) { console.error(balError); return; }

  // Filter in memory for Pre-2025
  const parseCompetence = (compStr) => {
      if (!compStr) return null;
      if (compStr.includes('/')) {
          const [month, year] = compStr.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, 1);
      }
      if (compStr.includes('-')) {
          const [year, month] = compStr.split('-');
          return new Date(parseInt(year), parseInt(month) - 1, 1);
      }
      return null;
  };
  
  const targetBalances = balances.filter(b => {
      const date = parseCompetence(b.competence);
      return date && date < new Date(2025, 0, 1);
  });

  console.log(`📋 Processing ${targetBalances.length} potential items...`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const bal of targetBalances) {
      // 3. Idempotency Check
      const { data: existing } = await supabase
          .from('accounting_entries')
          .select('id')
          .eq('reference_id', bal.id)
          .eq('reference_type', 'client_opening_balance');

      if (existing && existing.length > 0) {
          skippedCount++;
          // console.log(`Skipping ${bal.id} - Entry exists.`);
          continue;
      }

      // 4. Create Entry
      const clientName = bal.clients?.name || 'Cliente Desconhecido';
      // Generate "Certidao de Nascimento" (Source Hash)
      const sourceHash = crypto.createHash('sha256').update(`${bal.id}-${Date.now()}`).digest('hex');
      
      const entryPayload = {
          entry_date: SYSTEM_START_DATE, // Posting on 01/01/2025
          competence_date: SYSTEM_START_DATE, // Or map from competence string? Let's use start date for simplicity of Opening Balance
          description: `Saldo de Abertura - ${clientName} - Ref: ${bal.description} (${bal.competence})`,
          history: `Importação automática de Saldos Anteriores a 2025. Comp: ${bal.competence}`,
          entry_type: 'opening_balance',
          document_type: 'contract', // or other
          reference_type: 'client_opening_balance',
          reference_id: bal.id,
          total_debit: bal.amount,
          total_credit: bal.amount,
          balanced: true,
          source_type: 'client_opening_balance',
          source_id: bal.id,
          source_hash: sourceHash, // THE REQUIRED INTERNAL CODE/BIRTH CERTIFICATE
          created_by: null // system
      };

      const { data: entryData, error: entryErr } = await supabase
          .from('accounting_entries')
          .insert(entryPayload)
          .select()
          .single();

      if (entryErr) {
          console.error(`❌ Failed to create entry for ${bal.id}:`, entryErr);
          continue;
      }

      // 5. Create Lines
      const linesPayload = [
          {
              entry_id: entryData.id,
              account_id: DEBIT_ACCOUNT_ID, // 1.1.2.01 - Clientes
              debit: bal.amount,
              credit: 0,
              description: `Débito: ${clientName}`
          },
          {
              entry_id: entryData.id,
              account_id: CREDIT_ACCOUNT_ID_CANDIDATE, // 5.3.02.02 - Saldo Abertura
              debit: 0,
              credit: bal.amount,
              description: `Crédito: Contrapartida Saldo Abertura`
          }
      ];

      const { error: linesErr } = await supabase
          .from('accounting_entry_lines')
          .insert(linesPayload);

      if (linesErr) {
          console.error(`❌ Failed to create lines for entry ${entryData.id}:`, linesErr);
          // Rollback entry? Ideally yes, but Supabase JS doesn't do transactions easily without RPC.
          // For this script, we log error.
      } else {
          createdCount++;
          process.stdout.write('.');
      }
  }

  console.log(`\n\n✅ DONE!`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Skipped: ${skippedCount}`);
}

fixOpeningAccounting();
