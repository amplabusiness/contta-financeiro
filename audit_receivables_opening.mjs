
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

async function auditReceivablesOpening() {
  console.log("🔍 AUDIT: Receivables (Pre-2025 Opening Balances)...\n");

  // 1. Fetch all opening balances grouped by client
  // Competence format is typically 'YYYY-MM'
  const filterDate = '2025-01';

  const { data: balances, error } = await supabase
    .from('client_opening_balance')
    .select(`
      id,
      client_id,
      amount,
      competence,
      description,
      status,
      created_at,
      clients (
        name,
        cnpj
      )
    `)
    // .lt('competence', filterDate) // Removed SQL filter
    .eq('status', 'pending'); // Only Unpaid/Pending debts

  if (error) {
    console.error("Error fetching balances:", error);
    return;
  }

  // Helper to parse competence
  const parseCompetence = (compStr) => {
      if (!compStr) return null;
      // Handle MM/YYYY
      if (compStr.includes('/')) {
          const [month, year] = compStr.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, 1);
      }
      // Handle YYYY-MM
      if (compStr.includes('-')) {
          const [year, month] = compStr.split('-');
          return new Date(parseInt(year), parseInt(month) - 1, 1);
      }
      return null;
  };

  const CUTOFF_DATE = new Date(2025, 0, 1); // Jan 1, 2025

  // Filter in memory
  const filteredBalances = balances.filter(b => {
      const date = parseCompetence(b.competence);
      return date && date < CUTOFF_DATE;
  });

  // 2. Aggregate per Client
  const clientDebt = {};
  let totalDebt = 0;

  filteredBalances.forEach(b => {
    const clientName = b.clients?.name || 'Unknown Client';
    const clientId = b.client_id;
    
    if (!clientDebt[clientId]) {
      clientDebt[clientId] = {
        name: clientName,
        total: 0,
        items: []
      };
    }

    clientDebt[clientId].total += Number(b.amount);
    clientDebt[clientId].items.push({
      competence: b.competence,
      amount: Number(b.amount),
      desc: b.description || 'Saldo Abertura'
    });

    totalDebt += Number(b.amount);
  });

  // 3. Print Report
  console.log(`📉 TOTAL RECEIVABLES (Prior to Jan 2025): ${format(totalDebt)}\n`);
  
  // Sort clients by debt amount descending
  const sortedClients = Object.values(clientDebt).sort((a, b) => b.total - a.total);

  sortedClients.forEach((c) => {
    console.log(`👤 CLIENT: ${c.name}`);
    console.log(`   Total Debt: ${format(c.total)}`);
    console.log(`   Breakdown:`);
    c.items.sort((a,b) => a.competence.localeCompare(b.competence)); // Sort by date
    c.items.forEach(item => {
        console.log(`     - [${item.competence}] ${format(item.amount)} (${item.desc})`);
    });
    console.log("");
  });

  // Verify DB Integrity (Accounting)
  // Check if total matches 1.1.2.01 (or similar) balance?
  // Use Account ID 1.1.2.XX if known
  console.log("⚠️ Note: This audit lists the ADMINISTRATIVE DEBTS in 'client_opening_balance'.");
  console.log("   To ensure they are in the Balanço (Accounting), they must have generated journal entries.");
}

function format(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

auditReceivablesOpening();
