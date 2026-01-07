
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

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
  console.log("🧹 Cleaning up 12/2024 Duplicates...\n");

  // 1. Fetch all 12/2024
  const { data: balances, error } = await supabase
    .from('client_opening_balance')
    .select(`
      id, client_id, amount, created_at, 
      clients (name)
    `)
    .eq('competence', '12/2024');

  if (error) { console.error(error); return; }

  // 1.5 Fetch linked accounting entries manually
  const balanceIds = balances.map(b => b.id);
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, reference_id')
    .eq('reference_type', 'client_opening_balance')
    .in('reference_id', balanceIds);

  const entriesMap = {}; // reference_id -> array of entries usually one
  if (entries) {
      entries.forEach(e => {
          if (!entriesMap[e.reference_id]) entriesMap[e.reference_id] = [];
          entriesMap[e.reference_id].push(e);
      });
  }

  // Attach to balances for sorting logic
  balances.forEach(b => {
      b.accounting_entries = entriesMap[b.id] || [];
  });

  // 2. Group
  const groups = {};
  balances.forEach(b => {
    if (!groups[b.client_id]) groups[b.client_id] = [];
    groups[b.client_id].push(b);
  });

  // 3. Process
  for (const clientId in groups) {
    const items = groups[clientId];
    if (items.length > 1) {
      const clientName = items[0].clients?.name;
      console.log(`\n👥 ${clientName}: Found ${items.length} records for 12/2024.`);
      
      // Sort: entries with accounting ID first, then by created_at desc
      items.sort((a, b) => {
        const hasAccA = a.accounting_entries?.length > 0 ? 1 : 0;
        const hasAccB = b.accounting_entries?.length > 0 ? 1 : 0;
        if (hasAccA !== hasAccB) return hasAccB - hasAccA; // keep one with accounting
        return new Date(b.created_at) - new Date(a.created_at); // then newest
      });

      const survivor = items[0];
      const victims = items.slice(1);

      console.log(`   ✅ Keeping ID: ${survivor.id} (Accounting: ${survivor.accounting_entries?.length > 0}, Amt: ${survivor.amount})`);
      
      const victimIds = victims.map(v => v.id);
      console.log(`   🗑️  Deleting ${victimIds.length} duplicates...`);

      // Delete key constraints (accounting entries of victims) first?
      // Trigger might handle or Cascade delete? usually cascade.
      // But let's check if victims have accounting entries (shouldn't given sort, but verify)
      const victimsWithAcc = victims.filter(v => v.accounting_entries?.length > 0);
      if (victimsWithAcc.length > 0) {
        console.log(`      ⚠️ Warning: ${victimsWithAcc.length} victims have accounting entries. Deleting them too.`);
        const accIds = victimsWithAcc.flatMap(v => v.accounting_entries.map(e => e.id));
        await supabase.from('accounting_entries').delete().in('id', accIds);
      }

      const { error: delErr } = await supabase
        .from('client_opening_balance')
        .delete()
        .in('id', victimIds);
      
      if (delErr) console.error("      ❌ Error deleting:", delErr.message);
      else console.log("      ✨ Deleted.");

      // 4. Ensure Survivor has Accounting Entry
      if (!survivor.accounting_entries || survivor.accounting_entries.length === 0) {
        console.log(`   🔧 Creating Missing Accounting Entry for Survivor...`);
        await createAccountingEntry(survivor);
      }
    }
  }
}

async function createAccountingEntry(balance) {
  // Manual insertion matching the PL/SQL logic
  const { data: client } = await supabase.from('clients').select('name').eq('id', balance.client_id).single();
  
  // Hash
  const hash = crypto.createHash('sha256').update(balance.id + new Date().toISOString()).digest('hex');

  // Accounts (Hardcoded from migration)
  // Debit: 1.1.2.01 (Clients)
  // Credit: 5.3.02.02 (Opening Balance)
  const { data: accDebit } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.2.01').single();
  const { data: accCredit } = await supabase.from('chart_of_accounts').select('id').eq('code', '5.3.02.02').single();

  if (!accDebit || !accCredit) {
    console.error("      ❌ Startup accounts not found.");
    return;
  }

  const { data: entry, error: entErr } = await supabase
    .from('accounting_entries')
    .insert({
        entry_date: balance.created_at || new Date().toISOString(), // Use created_at or due_date? migration uses due_date or 2025-01-01. Let's use 2025-01-01 for opening balance logic often? 
        // Migration: COALESCE(NEW.due_date, '2025-01-01')
        // Balance due_date is likely 2024-12-XX.
        // Let's use 2024-12-31 to keep it in 2024? Or the due date.
        // If I use due_date (e.g. 2024-12-10), it lands in 2024. 
        // User wants "January 2025 extract pays Dec 2024 backward".
        // Use due_date is safer.
        entry_date: '2024-12-31', // Standardize Opening Balance to end of previous period? 
        competence_date: '2024-12-01',
        description: `Saldo Abertura - ${client.name}`,
        history: 'Recuperação Automática (Cleanup Script)',
        entry_type: 'opening_balance',
        document_type: 'opening_balance',
        reference_type: 'client_opening_balance',
        reference_id: balance.id,
        total_debit: balance.amount,
        total_credit: balance.amount,
        balanced: true,
        source_type: 'client_opening_balance',
        source_id: balance.id,
        source_hash: hash
    })
    .select()
    .single();

  if (entErr) {
     console.error("      ❌ Entry Insert Error:", entErr.message);
     return;
  }

  // Lines
  await supabase.from('accounting_entry_lines').insert([
    { entry_id: entry.id, account_id: accDebit.id, debit: balance.amount, credit: 0, description: `Débito: ${client.name}` },
    { entry_id: entry.id, account_id: accCredit.id, debit: 0, credit: balance.amount, description: 'Crédito: Saldo de Abertura' }
  ]);
  
  console.log("      ✅ Entry Created/Linked.");
}

cleanupDuplicates();
