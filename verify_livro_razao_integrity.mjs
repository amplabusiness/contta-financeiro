
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

async function verifyLivroRazao() {
  console.log("🔍 Verifying 'Livro Razão' Logic & Balances...\n");

  // 1. Get All Accounts
  const { data: accountsRaw } = await supabase.from('chart_of_accounts').select('*');
  const accounts = accountsRaw || [];
  
  // 1.1 Find 'Bank' Account (usually 1.1.1.05 or similar, looking for 'Santander' or 'Banco' in name)
  const bankAccount = accounts.find(a => a.code === '1.1.1.05');

  if (bankAccount) {
      console.log(`🏦 Analyzing Bank Account: [${bankAccount.code}] ${bankAccount.name}`);
      await analyzeAccountBalance(bankAccount, true);
  } else {
      console.warn("⚠️ Could not indentify main Bank Account automatically.");
  }

  // 1.2 Pick a 'Revenue' Account (Class 3 or 4 depending on Plan) - usually Class 3 is Revenue in some plans, or 4.
  // Let's assume 3 for Receita or 4.
  const revenueAccount = accounts.find(a => 
    a.name.toLowerCase().includes('receita') && a.is_analytical && (a.code.startsWith('3') || a.code.startsWith('4'))
  );
  
  if (revenueAccount) {
    console.log(`\n💰 Analyzing Revenue Account: [${revenueAccount.code}] ${revenueAccount.name}`);
    await analyzeAccountBalance(revenueAccount, false);
  }

}

async function analyzeAccountBalance(account, checkBankTable = false) {
    // 2. Fetch all lines for this account
    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select(`
            debit, 
            credit, 
            entry_id (
                entry_date
            )
        `)
        .eq('account_id', account.id);

    if (error) {
        console.error("Error fetching lines:", error);
        return;
    }

    // 3. Calculate Accounting Balance
    // Nature: 1 (Asset) = Debit, 4 (Expense) = Debit. Others Credit.
    const firstDigit = account.code.charAt(0);
    const isDevedora = ['1', '4', '5'].includes(firstDigit); // 5 usually Custos/Despesas too
    
    let totalDebit = 0;
    let totalCredit = 0;

    lines.forEach(l => {
        totalDebit += Number(l.debit || 0);
        totalCredit += Number(l.credit || 0);
    });

    const accountingBalance = isDevedora ? (totalDebit - totalCredit) : (totalCredit - totalDebit);

    console.log(`   - Total Debit found: ${format(totalDebit)}`);
    console.log(`   - Total Credit found: ${format(totalCredit)}`);
    console.log(`   - Calculated Balance (System): ${format(accountingBalance)} (${isDevedora ? 'D' : 'C'})`);

    // 4. Compare with Bank Table (Source of Truth for Money) if applicable
    if (checkBankTable) {
        const { data: bankData } = await supabase.from('bank_accounts').select('balance, name').limit(1);
        if (bankData && bankData.length > 0) {
            const realBankBalance = Number(bankData[0].balance);
            console.log(`   - Real Bank Account Balance (Table 'bank_accounts'): ${format(realBankBalance)}`);
            
            const diff = Math.abs(accountingBalance - realBankBalance);
            if (diff < 0.05) {
                console.log("   ✅ SUCCESS: Accounting Balance MATCHES Bank Balance.");
            } else {
                console.error(`   ❌ DISCREPANCY: Accounting differs from Bank by ${format(diff)}`);
                console.log("      Possible causes: Missing opening balance, Fees not posted, or Uncategorized transactions.");
            }
        }
    }
}

function format(n) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

verifyLivroRazao();
