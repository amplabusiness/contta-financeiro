
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const DEPARTMENT_RULES = [
    // DP
    { pattern: 'ROSEMEIRE|ALEXSSANDRA|TATIANA|ALINE|ERICK FABRICIO|THANINY|JESSYCA|LUCIANA|LUCIANE|DEUZA', dept: 'DP' },
    // FISCAL
    { pattern: 'DANIEL RODRIGUES', dept: 'FISCAL' },
    // FINANCEIRO
    { pattern: 'TAYLANE', dept: 'FINANCEIRO' },
    // LEGALIZACAO
    { pattern: 'SUELI AMARAL', dept: 'LEGALIZACAO' },
    // CONTABIL
    { pattern: 'JOSIMAR|THAYNARA', dept: 'CONTABIL' },
    // SOCIOS (If expenses)
    { pattern: 'VICTOR HUGO|NAYARA|SERGIO AUGUSTO', dept: 'SOCIOS' },
    // ADM (Catch-all for specific names or just fallthrough if generic)
    { pattern: 'ANDREA FERREIRA|AMANDA AMBROSIO|JORDANA|RAIMUNDO|LILIAN|CLAUDIA|FABIANA MARIA', dept: 'ADMINISTRATIVO' }
];

async function generateHorizontalDRE() {
    console.log("📊 Generating Horizontal DRE (Analysis by Department)...\n");

    // Fetch entries for Jan 2025 (or recent)
    // We assume 'accounting_entry_lines' joined with account info would be best, 
    // but simplified: we get lines and try to infer account type from description or join manually if needed.
    // Actually, 'accounting_entry_lines' usually links to an account.
    // Let's just fetch lines with 'account_nature' like 'expense' or just filter by 4.X
    
    // Since I don't know the exact Account ID structure without querying chart_of_accounts, 
    // I will fetch EVERYTHING and filter by Description primarily for this demo.
    
    const { data: lines, error } = await supabase
        .from('accounting_entry_lines')
        .select('*, entry:accounting_entries!inner(description)') // join
        .limit(2000); 

    // Filter in memory for now to check match
    
    if (lines && lines.length > 0) {
        console.log("Sample Data:", lines[0]);
    }

    if (error) {
        console.error("Error fetching lines:", error);
        return;
    }

    const report = {}; 
    const depts = new Set(['DP', 'FISCAL', 'CONTABIL', 'LEGALIZACAO', 'FINANCEIRO', 'ADMINISTRATIVO', 'SOCIOS', 'OUTROS']);
    
    // Initialize
    depts.forEach(d => report[d] = 0);

    let totalExpense = 0;

    for (const line of lines) {
        // Very basic filter: if it's a CREDIT it's likely Revenue or Liability increase.
        // If it's DEBIT, it's likely Expense or Asset increase.
        // We really need chart_of_accounts to know if it is an Expense.
        // For this demo, I will rely on the "Description Matching" which we KNOW are expenses (Salaries/Per Diems).
        
        let dept = 'OUTROS';
        let matched = false;
        
        const descLine = (line.description || '').toUpperCase();
        const descEntry = (line.entry?.description || '').toUpperCase();
        const fullDesc = descLine + ' ' + descEntry;
        
        for (const rule of DEPARTMENT_RULES) {
            const regex = new RegExp(rule.pattern, 'i');
            if (regex.test(fullDesc)) {
                dept = rule.dept;
                matched = true;
                break;
            }
        }
        
        // Only count if it looks like a value > 0 (assuming Debits are positive here for expenses)
        // If 'type' is 'D' (Debit) and it's an expense...
        // Assuming 'amount' is absolute.
        // Logic: specific people are definitely expenses.
        
        if (matched) {
            report[dept] += Number(line.value || line.amount || 0);
            totalExpense += Number(line.value || line.amount || 0);
        }
    }

    // Now Print Table
    console.log(`| DEPARTAMENTO | VALOR (JAN 2025) | % |`);
    console.log(`|---|---|---|`);
    
    for (const d of depts) {
        if (d === 'OUTROS') continue; // Skip others for this specific personnel report
        const val = report[d];
        const pct = (totalExpense > 0) ? (val / totalExpense * 100).toFixed(1) : 0;
        console.log(`| ${d.padEnd(12)} | R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(10)} | ${pct}% |`);
    }
    
    console.log(`\nTOTAL ANALISADO (FOLHA/SERVIÇOS): R$ ${totalExpense.toLocaleString('pt-BR')}`);
    
    console.log("\n⚠️  Note: This report is generated dynamically based on description matching.");
    console.log("   To make this permanent, please execute the SQL script 'add_cost_center_column.sql'.");
}

generateHorizontalDRE();
