
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(rootDir, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

// Report Directory
const REPORT_DIR = path.join(rootDir, 'REPORTS');
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR);
}

async function runAuditor() {
    console.log("🧐 DR. CICERO: Initializing Accounting Audit...");
    
    // 1. Fetch Balancete (General Ledger)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Fetch VIEW v_balancete
    const { data: balances, error } = await supabase
        .from('v_balancete')
        .select('*')
        .eq('year', currentYear)
        .eq('month', currentMonth);

    if (error) { console.error("❌ DB Error:", error); return; }

    console.log(`📊 Analyzing ${balances.length} accounts for ${currentMonth}/${currentYear}...`);

    let anomalies = [];
    let warnings = [];

    // 2. Rules Engine
    balances.forEach(acc => {
        const bal = Number(acc.balance);
        const code = acc.account_code;
        const name = acc.account_name;
        
        // Rule 1: Inverted Sign (Balance < 0 for most accounts is bad, but VIEW calculates Balance based on Nature)
        // The View v_balancete already handles (Debit-Credit) or (Credit-Debit).
        // So 'balance' should generally be POSITIVE. If it is NEGATIVE, it means "Natureza Invertida".
        // Exception: Some adjustment accounts.
        
        if (bal < 0 && Math.abs(bal) > 0.01) { // Ignore rounding errors
             // Check if it's a known reducing account (Redutora) usually marked in code? 
             // Ideally 'nature' handles this, but if the RESULT is negative, it's inverted.
             anomalies.push({
                 code,
                 name,
                 issue: 'INVERTED_BALANCE',
                 details: `Balance is negative (R$ ${bal.toFixed(2)}). Depending on account nature, this might be an inversion.`
             });
        }

        // Rule 2: High Value in "Others" (Outros)
        if (name.toLowerCase().includes('outros') || name.toLowerCase().includes('diversos')) {
            if (bal > 5000) {
                warnings.push({
                     code,
                     name,
                     issue: 'HIGH_VALUE_GENERIC',
                     details: `Account "Others" has high balance (R$ ${bal.toFixed(2)}). Recommend reclassification.`
                });
            }
        }
        
        // Rule 3: Cash Account Negative? (Already covered by Rule 1 mostly, but specific check)
        if (acc.account_type === 'ATIVO' && name.toLowerCase().includes('caixa') && bal < 0) {
             anomalies.push({
                 code,
                 name,
                 issue: 'NEGATIVE_CASH',
                 details: `IMPOSSIBLE: Physical cash account is negative.`
             });
        }
    });

    // 3. Generate Report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(REPORT_DIR, `AUDIT_REPORT_${timestamp}.md`);

    let reportContent = `# 🧐 DR. CICERO AUDIT REPORT\n`;
    reportContent += `**Reference:** ${currentMonth}/${currentYear}\n`;
    reportContent += `**Date:** ${new Date().toLocaleString()}\n`;
    reportContent += `**Accounts Analyzed:** ${balances.length}\n\n`;

    if (anomalies.length === 0 && warnings.length === 0) {
        reportContent += `## ✅ STATUS: PASS\n`;
        reportContent += `No accounting anomalies detected.\n`;
        console.log("✅ STATUS: PASS - Accounting looks clean.");
    } else {
        if (anomalies.length > 0) {
            reportContent += `## ❌ ERRORS (Require Correction)\n`;
            anomalies.forEach(a => {
                reportContent += `- **[${a.code}] ${a.name}**: ${a.issue}\n  - ${a.details}\n`;
            });
            console.log(`❌ STATUS: FAIL - Found ${anomalies.length} anomalies.`);
        }
        
        if (warnings.length > 0) {
            reportContent += `\n## ⚠️ WARNINGS (Review Recommended)\n`;
            warnings.forEach(w => {
                reportContent += `- **[${w.code}] ${w.name}**: ${w.issue}\n  - ${w.details}\n`;
            });
        }
        console.log(`📝 Report generated: ${reportFile}`);
    }

    fs.writeFileSync(reportFile, reportContent);
}

runAuditor();
