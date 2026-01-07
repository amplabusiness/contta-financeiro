
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function generateUnifiedCashFlow() {
    console.log("💰 Relatório Unificado de Fluxo de Caixa (AMPLA CONTABILIDADE)");
    console.log("==============================================================");
    
    const today = new Date();
    console.log(`Data Base: ${today.toLocaleDateString('pt-BR')}\n`);

    // 1. Get Current Bank Balance
    const { data: accounts, error: errBank } = await supabase
        .from('bank_accounts')
        .select('bank_name, balance')
        .eq('is_active', true);

    if (errBank) { console.error("Error Bank:", errBank); return; }

    let totalBank = 0;
    console.log("SALDO EM CONTA");
    console.log("--------------");
    accounts.forEach(acc => {
        const bal = Number(acc.balance || 0);
        totalBank += bal;
        console.log(`${acc.bank_name.padEnd(30)}: R$ ${bal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });
    console.log(`TOTAL DISPONÍVEL              : R$ ${totalBank.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);


    // 2. Get Open Invoices (Receivable) - Simple query for unpaid invoices
    // Only pending and future due_date or overdue
    const { data: invoices, error: errInv } = await supabase
        .from('invoices')
        .select('due_date, amount, client:clients(name)')
        .eq('status', 'pending');

    if (errInv) { console.error("Error Invoices:", errInv); return; }

    const receivables = invoices.map(i => ({
        date: i.due_date,
        type: 'RECEITA_HONORARIOS',
        desc: `Honorário - ${i.client?.name}`,
        amount: Number(i.amount)
    }));


    // 3. Get Payables (Payroll Projections)
    const { data: payroll, error: errPay } = await supabase.from('v_projections_payroll').select('*');
    const { data: pj, error: errPJ } = await supabase.from('v_projections_contractors').select('*');

    const payables = [];
    if (payroll) {
        payroll.forEach(p => payables.push({
            date: p.due_date,
            type: p.type,
            desc: p.description,
            amount: -Number(p.amount) // Negative for cash flow
        }));
    }
    if (pj) {
        pj.forEach(p => payables.push({
            date: p.due_date,
            type: p.type,
            desc: p.description,
            amount: -Number(p.amount)
        }));
    }

    // 4. Merge and Sort
    const allEvents = [...receivables, ...payables];
    allEvents.sort((a, b) => a.date.localeCompare(b.date));

    // 5. Daily Projection
    let runningBalance = totalBank;
    let lastDate = '';

    console.log("PROJEÇÃO DIÁRIA");
    console.log("---------------------------------------------------------------------------------");
    console.log(`DATA       | TIPO                 | DESCRIÇÃO                      | VALOR       | SALDO ACUM.`);
    console.log(`-----------|----------------------|--------------------------------|-------------|-------------`);

    // Limit output to next 45 days
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + 45);

    for (const ev of allEvents) {
        if (new Date(ev.date) > limitDate) continue;
        if (new Date(ev.date) < new Date(today.getFullYear(), today.getMonth(), 1)) {
             // Skip very old overdue items for clarity, or group them as "ATRASADOS"
             // For now, let's include them.
        }

        runningBalance += ev.amount;
        
        const dateStr = new Date(ev.date).toLocaleDateString('pt-BR');
        const typeStr = ev.type.substring(0, 20).padEnd(20);
        const descStr = ev.desc.substring(0, 30).padEnd(30);
        const valStr = ev.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(11);
        const balStr = runningBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(13);

        console.log(`${dateStr} | ${typeStr} | ${descStr} | ${valStr} | ${balStr}`);
    }
    console.log("---------------------------------------------------------------------------------");
}

generateUnifiedCashFlow();
