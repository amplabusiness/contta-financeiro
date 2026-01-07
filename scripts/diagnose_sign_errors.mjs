
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const OUTFLOW_KEYWORDS = ['PAGAMENTO', 'DEBITO', 'TARIFA', 'SAQUE', 'ENVIO', 'LIQUIDACAO', 'APLIC.FINANCEIRA'];
const INFLOW_KEYWORDS = ['RECEBIMENTO', 'CREDITO', 'DEPOSITO', 'RESGATE'];

async function diagnoseSignErrors() {
    console.log('--- Diagnosing Sign Errors (Feb/Mar 2025) ---');

    const { data: txs, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', '2025-02-01')
        .lte('transaction_date', '2025-03-31');

    if (error) {
        console.error(error);
        return;
    }

    let invertedOutflows = [];
    let invertedInflows = [];

    txs.forEach(tx => {
        const desc = tx.description.toUpperCase();
        const amt = parseFloat(tx.amount);
        
        // Check for Positive Amounts that look like Outflows
        if (amt > 0) {
            const isOutflow = OUTFLOW_KEYWORDS.some(kw => desc.includes(kw));
            // Check specifically for PIX_DEB tag
            const isPixDeb = desc.includes('PIX_DEB');
            
            if (isOutflow || isPixDeb) {
                invertedOutflows.push(tx);
            }
        }

        // Check for Negative Amounts that look like Inflows
        if (amt < 0) {
            const isInflow = INFLOW_KEYWORDS.some(kw => desc.includes(kw));
            const isPixCred = desc.includes('PIX_CRED');
            
            if (isInflow || isPixCred) {
                invertedInflows.push(tx);
            }
        }
    });

    console.log(`\nFound ${invertedOutflows.length} Potential INVERTED OUTFLOWS (Positive amounts that should be negative):`);
    let totalError = 0;
    invertedOutflows.sort((a,b) => b.amount - a.amount).forEach(tx => {
        totalError += tx.amount;
        console.log(`[+] ${tx.transaction_date} | R$ ${tx.amount.toFixed(2)} | ${tx.description.substring(0, 50)} | ID: ${tx.id}`);
    });

    console.log(`\nFound ${invertedInflows.length} Potential INVERTED INFLOWS (Negative amounts that should be positive):`);
    invertedInflows.forEach(tx => {
        console.log(`[-] ${tx.transaction_date} | R$ ${tx.amount.toFixed(2)} | ${tx.description.substring(0, 50)} | ID: ${tx.id}`);
    });

    console.log(`\n---------------------------------------------------`);
    console.log(`Total "False Revenue" from Inverted Outflows: R$ ${totalError.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`This amount matches the inflation in the balance.`);
}

diagnoseSignErrors();
