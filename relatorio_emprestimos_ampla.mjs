
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const CC_AMPLA_SAUDE = 'e84d8dd4-7ca8-4a3a-8390-e6487e54f20c';

async function generateLoanReport() {
    console.log("📊 Relatório de Empréstimos - Ampla Saúde Ocupacional (conta patrimonial)");
    console.log("=========================================================================");

    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            id,
            debit,
            credit,
            account:chart_of_accounts(name, code, type),
            entry:accounting_entries!inner (
                entry_date,
                description
            )
        `)
        .eq('cost_center_id', CC_AMPLA_SAUDE)
        .order('entry(entry_date)', { ascending: true });

    if (error) {
        console.error("Error:", error);
        return;
    }

    let balance = 0;
    
    console.log(`DATA       | DESCRIÇÃO                                    | VALOR       | SALDO (A RECEBER)`);
    console.log(`-----------|----------------------------------------------|-------------|------------------`);

    for (const line of lines) {
        // Skip Bank Accounts to avoid double counting and zeroing out
        const accountName = line.account?.name || '';
        if (accountName.toLowerCase().includes('banco') || accountName.toLowerCase().includes('caixa')) {
            continue;
        }

        const desc = line.entry.description.substring(0, 44).padEnd(44);
        const date = new Date(line.entry.entry_date).toLocaleDateString('pt-BR');
        
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        
        // Debit on Non-Bank Account (Asset) = Loan Increase
        // Credit on Non-Bank Account (Asset) = Loan Decrease
        let flow = debit - credit;
        balance += flow;

        console.log(`${date} | ${desc} | ${flow.toFixed(2).padStart(11)} | ${balance.toFixed(2).padStart(16)}`);
    }

    console.log(`-----------------------------------------------------------------------------------------`);
    console.log(`💰 SALDO ATUAL DO EMPRÉSTIMO (A RECEBER): R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`=========================================================================================`);
}

generateLoanReport();
