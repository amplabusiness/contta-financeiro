
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugJan2025Revenue() {
  console.log("=== Debug Receitas Janeiro 2025 ===");

  const startDate = '2025-01-01';
  const endDate = '2025-01-31';

  // 1. Check all accounting entries in Jan 2025
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      description,
      accounting_entry_lines (
        id,
        account_id,
        debit,
        credit,
        chart_of_accounts (
          code,
          name,
          nature
        )
      )
    `)
    .gte('entry_date', startDate)
    .lte('entry_date', endDate);

  if (error) {
    console.error("Erro ao buscar entries:", error);
    return;
  }

  console.log(`Encontrados ${entries.length} lançamentos em Jan 2025.`);

  let totalReceitaCalculada = 0;
  let totalDebitoReceber = 0;

  // Analyze where the credits are going
  const creditAccounts = {};

  for (const entry of entries) {
    if (!entry.accounting_entry_lines) continue;

    for (const line of entry.accounting_entry_lines) {
        const credit = Number(line.credit || 0);
        const debit = Number(line.debit || 0);
        const code = line.chart_of_accounts?.code;
        const name = line.chart_of_accounts?.name;

        // Check Debits to Accounts Receivable (1.1.2.01)
        if (code === '1.1.2.01') {
            totalDebitoReceber += debit;
        }

        // Check Credits
        if (credit > 0) {
            if (!creditAccounts[code]) {
                creditAccounts[code] = { name, total: 0, count: 0 };
            }
            creditAccounts[code].total += credit;
            creditAccounts[code].count += 1;

            // If it's Group 3 (Revenue)
            if (code.startsWith('3')) {
                totalReceitaCalculada += credit;
            }
        }
    }
  }

  console.log("\n--- Resumo ---");
  console.log(`Total Débito em Contas a Receber (1.1.2.01): R$ ${totalDebitoReceber.toFixed(2)}`);
  console.log(`Total Crédito em Contas de Receita (Grupo 3): R$ ${totalReceitaCalculada.toFixed(2)}`);

  console.log("\n--- Destino dos Créditos ---");
  console.table(
    Object.entries(creditAccounts)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.total - a.total)
  );
}

debugJan2025Revenue();
