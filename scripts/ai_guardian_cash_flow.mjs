
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

async function runGuardian() {
    console.log("🤖 AI GUARDIAN: Initializing Cash Flow Analysis...");
    
    const today = new Date();
    const projectionDays = 60; // Look ahead 60 days
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + projectionDays);
    const limitDateStr = limitDate.toISOString().split('T')[0];

    // 1. Fetch Data
    const { data: accounts, error: errBank } = await supabase
        .from('bank_accounts')
        .select('balance')
        .eq('is_active', true);

    if (errBank) { console.error("❌ Bank Error:", errBank); return; }
    const currentBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;

    // Fetch unified flow
    const { data: flowData, error: errFlow } = await supabase
        .from('v_cash_flow_daily')
        .select('*')
        .lte('due_date', limitDateStr)
        .order('due_date', { ascending: true })
        .range(0, 9999); // Simulating loop or high limit

    if (errFlow) { console.error("❌ Flow Error:", errFlow); return; }

    // 2. Process Flow
    console.log(`📊 Analyzing ${flowData.length} future events...`);
    
    let runningBalance = currentBalance;
    const alertDays = [];
    const eventsByDate = {};

    // Group events
    flowData.forEach(item => {
        const d = item.due_date;
        if (!eventsByDate[d]) eventsByDate[d] = { amount: 0, events: [] };
        eventsByDate[d].amount += item.value;
        eventsByDate[d].events.push(item);
    });

    // Simulate Timeline
    const cursor = new Date(today);
    let minBalance = currentBalance;
    let minBalanceDate = today.toISOString().split('T')[0];

    while (cursor <= limitDate) {
        const dStr = cursor.toISOString().split('T')[0];
        const dayData = eventsByDate[dStr];
        
        if (dayData) {
            runningBalance += dayData.amount;
        }

        if (runningBalance < minBalance) {
            minBalance = runningBalance;
            minBalanceDate = dStr;
        }

        if (runningBalance < 0) {
            alertDays.push({
                date: dStr,
                balance: runningBalance,
                dailyChange: dayData ? dayData.amount : 0,
                majorEvents: dayData ? dayData.events.sort((a,b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3) : [] // Top 3 impacts
            });
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    // 3. Generate Report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(REPORT_DIR, `GUARDIAN_REPORT_${timestamp}.md`);

    let reportContent = `# 🤖 AI GUARDIAN REPORT (Cash Flow)\n`;
    reportContent += `**Date:** ${today.toLocaleString()}\n`;
    reportContent += `**Analysis Window:** ${projectionDays} days\n`;
    reportContent += `**Current Balance:** R$ ${currentBalance.toFixed(2)}\n`;
    reportContent += `**Lowest Projected Balance:** R$ ${minBalance.toFixed(2)} (on ${minBalanceDate})\n\n`;

    if (alertDays.length === 0) {
        reportContent += `## ✅ STATUS: GREEN\n`;
        reportContent += `No negative balances detected in the next ${projectionDays} days.\n`;
        console.log("✅ STATUS: GREEN - Cash Flow is Healthy.");
    } else {
        reportContent += `## 🚨 STATUS: RED - ATTENTION REQUIRED\n`;
        reportContent += `Negative balance detected on **${alertDays.length}** days.\n\n`;
        
        reportContent += `### 📅 Negative Balance Timeline\n`;
        alertDays.forEach(alert => {
            reportContent += `- **${alert.date}**: Balance **R$ ${alert.balance.toFixed(2)}** (Change: R$ ${alert.dailyChange.toFixed(2)})\n`;
            if (alert.majorEvents.length > 0) {
                reportContent += `  - *Top Impacts:*\n`;
                alert.majorEvents.forEach(e => {
                    const typeIcon = getIcon(e.type);
                    reportContent += `    - ${typeIcon} ${e.description}: R$ ${e.value.toFixed(2)}\n`;
                });
            }
        });
        
        reportContent += `\n### 💡 AI Recommendations (Heuristic)\n`;
        reportContent += suggestsActions(alertDays[0]);
        
        console.log(`🚨 STATUS: RED - Negative Balance projected! See report: ${reportFile}`);
    }

    fs.writeFileSync(reportFile, reportContent);
    console.log(`📝 Report generated: ${reportFile}`);
}

function getIcon(type) {
    if (type === 'RECEIVABLE') return '💰';
    if (type === 'PAYROLL') return '👥';
    if (type === 'CONTRACTOR') return '👷';
    if (type === 'TAX') return '🏛️';
    if (type === 'RECURRING') return '🔄';
    return '📝';
}

function suggestsActions(firstAlert) {
    let suggestions = "";
    suggestions += `- **Immediate Action:** The cash flow turns negative on **${firstAlert.date}**.\n`;
    suggestions += `- **Check Receivables:** Verify if any invoices due before ${firstAlert.date} can be anticipated.\n`;
    suggestions += `- **Defer Payments:** Look at the major expenses on ${firstAlert.date}: \n`;
    firstAlert.majorEvents.filter(e => e.value < 0).forEach(e => {
        suggestions += `  - Can "${e.description}" (R$ ${Math.abs(e.value).toFixed(2)}) be negotiated?\n`;
    });
    return suggestions;
}

runGuardian();
