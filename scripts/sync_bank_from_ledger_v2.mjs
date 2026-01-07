
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncBankTransactions() {
  console.log('🔄 Syncing bank_transactions from accounting_entries (Jan 2025)...');

  const startDate = '2025-01-01';
  const endDate = '2025-01-31';

  // 1. Find Bank Account
  const { data: accounts, error: accError } = await supabase
    .from('chart_of_accounts')
    .select('id, name, code')
    .ilike('name', '%Sicredi%')
    .limit(1);

  if (accError || !accounts.length) {
    console.error('❌ Could not find Sicredi account.', accError);
    return;
  }
  const bankAccountId = accounts[0].id;
  console.log(`🏦 Found Bank Account: ${accounts[0].name} (${accounts[0].code})`);

  // 2. Fetch Accounting Entries in Range
  const { data: entries, error: entriesError } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, transaction_id')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate);

  if (entriesError) {
    console.error('❌ Error fetching accounting entries:', entriesError);
    return;
  }
  
  const entryIds = entries.map(e => e.id);
  const entryMap = new Map(entries.map(e => [e.id, e]));

  if (entryIds.length === 0) {
    console.log('No accounting entries found in period.');
    return;
  }
  
  console.log(`Found ${entryIds.length} entries in period.`);

  // 3. Fetch Lines associated with these entries AND the bank account
  // Need to chunk if too many IDs (Postgres limit usually ~65k params, safe with 1000s)
  // Assuming < 5000 entries for Jan.
  
  const allLines = [];
  const chunkSize = 50;
  for (let i = 0; i < entryIds.length; i += chunkSize) {
    const chunkIds = entryIds.slice(i, i + chunkSize);
    const { data: linesChunk, error: linesError } = await supabase
      .from('accounting_entry_lines')
      .select('id, debit, credit, entry_id')
      .eq('account_id', bankAccountId)
      .in('entry_id', chunkIds);

    if (linesError) {
      console.error('❌ Error fetching ledger lines chunk:', linesError);
      return;
    }
    if (linesChunk) {
      allLines.push(...linesChunk);
    }
  }

  const lines = allLines;
  console.log(`Found ${lines.length} ledger lines related to Bank.`);

  // 3.5 Clear existing bank_transactions for Jan 2025
  const { error: deleteError } = await supabase
    .from('bank_transactions')
    .delete()
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);
    
  if (deleteError) {
    console.error('❌ Error clearing bank_transactions:', deleteError);
    return;
  }
  console.log('🧹 Cleared existing bank_transactions for Jan 2025.');

  // 4. Transform and Insert
  const newTransactions = lines.map(line => {
    // Determine type and amount from debit/credit columns
    // This is the LEDGER line.
    // If Debit > 0, it's a Ledger Debit.
    const ledgerDebit = Number(line.debit || 0);
    const ledgerCredit = Number(line.credit || 0);
    
    // In Accounting:
    // Debit to Asset Account (Bank) = Increase = Inflow
    // Credit to Asset Account (Bank) = Decrease = Outflow
    
    // In Bank Transactions (often reversed in terminology or simply Inflow/Outflow):
    // If using 'credit' / 'debit' strings:
    // Usually Bank Credit = Inflow (Money crediting the account)
    // Bank Debit = Outflow (Money debited from the account)
    
    let bankType; 
    let amount;

    if (ledgerDebit > 0) {
       // Ledger Debit = Asset Increas = Inflow => Bank Credit
       bankType = 'credit';
       amount = ledgerDebit;
    } else {
       // Ledger Credit = Asset Decrease = Outflow => Bank Debit
       bankType = 'debit';
       amount = ledgerCredit;
    }
    
    const parentEntry = entryMap.get(line.entry_id);

    return {
      transaction_date: parentEntry.entry_date,
      amount: amount,
      description: parentEntry.description || 'Synced from Ledger',
      transaction_type: bankType,
      matched: true,
      journal_entry_id: parentEntry.id
    };
  });

  // Batch insert
  const batchSize = 100;
  for (let i = 0; i < newTransactions.length; i += batchSize) {
    const batch = newTransactions.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('bank_transactions')
      .insert(batch);
    
    if (insertError) {
      console.error('❌ Error inserting batch:', insertError);
    } else {
      process.stdout.write(`.` ); // progress dot
    }
  }
  console.log('\n✅ Sync Complete.');
}

syncBankTransactions();
