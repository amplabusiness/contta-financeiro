
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fullAudit() {
    console.log("=== Auditoria Completa: Extrato vs Banco de Dados ===");

    // 1. Analisar JSON do Extrato (OFX)
    const ofxPath = path.resolve(__dirname, '../_ofx_jan2025.json');
    if (!fs.existsSync(ofxPath)) {
        console.error("Arquivo _ofx_jan2025.json não encontrado.");
        return;
    }
    const ofxData = JSON.parse(fs.readFileSync(ofxPath, 'utf8'));
    
    let ofxDebits = 0; // Negative in JSON, but we'll sum abs for comparison
    let ofxCredits = 0; // Positive in JSON
    
    ofxData.forEach(tx => {
        const val = Number(tx.amount);
        if (val < 0) ofxDebits += Math.abs(val); // Saída money
        else ofxCredits += val; // Entrada money
    });

    const ofxNet = ofxCredits - ofxDebits;

    console.log(`\n[EXTRATO BANCÁRIO (OFX)]`);
    console.log(`Entradas: R$ ${ofxCredits.toFixed(2)}`);
    console.log(`Saídas:   R$ ${ofxDebits.toFixed(2)}`);
    console.log(`Saldo Líquido Jan/2025: R$ ${ofxNet.toFixed(2)}`);

    // 2. Analisar Banco de Dados (Sicredi)
    const { data: account } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.1.05').single();
    const accountId = account.id;

    // 2.1 Saldo de Abertura (Tudo antes de Jan 2025)
    // OBS: Conta Débito = Aumenta Saldo (+), Crédito = Diminui Saldo (-)
    // Na contabilidade: Banco é Ativo. Débito = Entrada. Crédito = Saída.
    const { data: opening } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, description, accounting_entries!inner(entry_date, description)')
        .eq('account_id', accountId)
        .lt('accounting_entries.entry_date', '2025-01-01');

    let dbOpening = 0;
    console.log(`\n[BANCO DE DADOS - SALDO INICIAL]`);
    if (opening && opening.length > 0) {
        opening.forEach(o => {
            const val = (Number(o.debit)||0) - (Number(o.credit)||0);
            dbOpening += val;
            console.log(`- ${o.accounting_entries.entry_date}: ${o.accounting_entries.description} -> R$ ${val.toFixed(2)}`);
        });
    } else {
        console.log("- Sem lançamentos anteriores a 01/01/2025.");
    }
    console.log(`TOTAL ABERTURA (01/01/2025): R$ ${dbOpening.toFixed(2)}`);

    // 2.2 Movimento Jan 2025
    const { data: moveJan } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, accounting_entries!inner(entry_date)')
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');

    let dbDebits = 0; // Entradas
    let dbCredits = 0; // Saídas

    moveJan?.forEach(m => {
        dbDebits += Number(m.debit || 0);
        dbCredits += Number(m.credit || 0);
    });

    const dbNet = dbDebits - dbCredits;
    const dbClosing = dbOpening + dbNet;

    console.log(`\n[BANCO DE DADOS - JAN/2025]`);
    console.log(`Entradas (Débitos): R$ ${dbDebits.toFixed(2)}`);
    console.log(`Saídas (Créditos):  R$ ${dbCredits.toFixed(2)}`);
    console.log(`Saldo Líquido:      R$ ${dbNet.toFixed(2)}`);
    console.log(`\n[RESULTADO FINAL]`);
    console.log(`Saldo Final Calculado (31/01/2025): R$ ${dbClosing.toFixed(2)}`);
    
    // Check difference
    const diffEntradas = Math.abs(ofxCredits - dbDebits);
    const diffSaidas = Math.abs(ofxDebits - dbCredits);
    
    if (diffEntradas < 0.1 && diffSaidas < 0.1) {
        console.log("\n✅ CONCILIAÇÃO PERFEITA: O extrato OFX bate exatamente com o Banco de Dados.");
    } else {
        console.log("\n⚠️ DIVERGÊNCIA ENCONTRADA:");
        console.log(`Diferença Entradas: R$ ${diffEntradas.toFixed(2)}`);
        console.log(`Diferença Saídas:   R$ ${diffSaidas.toFixed(2)}`);
    }

    // 2.3 Check 01/02
    console.log(`\n[SALDO EM 01/02/2025]`);
    // Assuming no movements very early on Feb 1st or just carrying over
    console.log(`Inicio do dia 01/02/2025: R$ ${dbClosing.toFixed(2)}`);
}

fullAudit();
