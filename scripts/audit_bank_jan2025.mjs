
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Use SERVICE ROLE key to bypass RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error("SERVICE ROLE KEY NOT FOUND!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBankBalances() {
    console.log("=== Auditoria de Saldo Bancário (Sicredi) ===");

    // 1. Buscar a conta do Banco Sicredi
    const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('code', '1.1.1.05')
        .single();
    
    if (!accounts) {
        console.error("Conta 1.1.1.05 não encontrada!");
        return;
    }
    const accountId = accounts.id;
    console.log(`Conta: ${accounts.code} - ${accounts.name} (${accountId})`);

    // 2. Calcular saldo inicial em 01/01/2025
    // Saldo = Débitos - Créditos anteriores a 2025-01-01
    const { data: priorEntries } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, accounting_entries!inner(entry_date)')
        .eq('account_id', accountId)
        .lt('accounting_entries.entry_date', '2025-01-01');
    
    let saldoInicial = 0;
    if (priorEntries) {
        saldoInicial = priorEntries.reduce((acc, curr) => acc + (Number(curr.debit) || 0) - (Number(curr.credit) || 0), 0);
    }
    console.log(`\nSaldo Inicial (01/01/2025): R$ ${saldoInicial.toFixed(2)}`);

    // 3. Movimentação de Janeiro
    const { data: janEntries } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, accounting_entries!inner(entry_date)')
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31')
        .order('accounting_entries(entry_date)', { ascending: true });

    let debitosJan = 0;
    let creditosJan = 0;
    
    if (janEntries) {
        janEntries.forEach(e => {
            debitosJan += Number(e.debit || 0);
            creditosJan += Number(e.credit || 0);
        });
    }

    const saldoFinalJan = saldoInicial + debitosJan - creditosJan;

    console.log(`\n--- Movimentação Janeiro 2025 ---`);
    console.log(`(+) Débitos (Entradas): R$ ${debitosJan.toFixed(2)}`);
    console.log(`(-) Créditos (Saídas):  R$ ${creditosJan.toFixed(2)}`);
    console.log(`(=) Saldo Final (31/01/2025): R$ ${saldoFinalJan.toFixed(2)}`);


    // 4. Movimentação de 01/02/2025
    // Para conferir se bate com o "início" de fevereiro
    const { data: feb1Entry } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, accounting_entries!inner(entry_date)')
        .eq('account_id', accountId)
        .eq('accounting_entries.entry_date', '2025-02-01');
    
     let debitosFeb1 = 0;
     let creditosFeb1 = 0;
     if (feb1Entry) {
         feb1Entry.forEach(e => {
             debitosFeb1 += Number(e.debit || 0);
             creditosFeb1 += Number(e.credit || 0);
         });
     }

     const saldoFinalFeb1 = saldoFinalJan + debitosFeb1 - creditosFeb1;
     console.log(`\n--- 01/02/2025 ---`);
     console.log(`(+) Débitos: R$ ${debitosFeb1.toFixed(2)}`);
     console.log(`(-) Créditos: R$ ${creditosFeb1.toFixed(2)}`);
     console.log(`(=) Saldo Final (01/02/2025): R$ ${saldoFinalFeb1.toFixed(2)}`);

}

checkBankBalances();
