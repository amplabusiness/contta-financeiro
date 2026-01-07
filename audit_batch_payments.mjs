
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// import csvParser from 'csv-parser'; // Removed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function parseBrFloat(str) {
    if (!str) return 0;
    // Remove dots (thousands), replace comma with dot
    const clean = str.replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(clean);
}

function parseBrDate(str) {
    if(!str) return null;
    const parts = str.split('/');
    if(parts.length !== 3) return null;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

async function auditBatches() {
    console.log("🕵️  AUDIT: Matching CSV Batches to Bank Transactions...\n");

    const csvPath = path.join(__dirname, 'banco', 'clientes boletos jan.csv');
    if (!fs.existsSync(csvPath)) {
        console.error("❌ CSV file not found:", csvPath);
        return;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');
    const rows = [];
    
    // Headers are in line 0?
    // "Documento;N do boleto..."
    // Let's assume order based on preview:
    // 0: Documento, 1: N boleto, 2: Pagador, 3: Vencimento, 4: Liquidacao, 5: Valor Boleto, 6: Valor Recebido, 7: Data Extrato
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(';');
        if (cols.length < 8) continue;

        rows.push({
            'Documento': cols[0],
            'Pagador': cols[2],
            'Data Vencimento': cols[3],
            ' valor recebido ': cols[6], // 6th index is 7th column?  0,1,2,3,4,5,6. Yes.
            'data do extrato': cols[7]
        });
    }

    console.log(`📋 CSV Loaded: ${rows.length} rows.`);
    await processRows(rows);
}

async function processRows(rows) {
    // 1. Group by Documento (Batch ID)
    const batches = {};
    
    rows.forEach(row => {
        const doc = row['Documento'];
        // Some rows might be empty or footer
        if (!doc) return;

        if (!batches[doc]) {
            batches[doc] = {
                id: doc,
                date: parseBrDate(row['data do extrato']),
                total: 0,
                items: []
            };
        }
        const val = parseBrFloat(row[' valor recebido ']); // keys generally have spaces in this CSV?
        // Let's inspect raw keys later if needed, but ' valor recebido ' seems likely based on file read.
        // Actually csv-parser trims headers by default? No.
        // I'll check keys dynamically.
        
        batches[doc].total += val;
        batches[doc].items.push({
            payer: row['Pagador'],
            amount: val,
            dueDate: parseBrDate(row['Data Vencimento'])
        });
    });

    console.log(`📦 Found ${Object.keys(batches).length} unique batches.`);

    // 2. Check Database Match
    for (const batchId in batches) {
        const batch = batches[batchId];
        const roundedTotal = Math.round(batch.total * 100) / 100;

        console.log(`\n🔹 Batch ${batchId} | Date: ${batch.date} | Total CSV: R$ ${roundedTotal}`);

        // Search in DB
        // Range: +/- 1 day to be safe?
        // Bank transactions usually exact date match with CSV 'data do extrato'.
        
        const { data: txs, error } = await supabase
            .from('bank_transactions')
            .select('id, transaction_date, amount, description')
            .eq('transaction_date', batch.date)
            // .eq('amount', roundedTotal) // Exact match?
            // Signs might be positive or negative. Receipts are positive.
            // Let's search range or just by date and filter in JS
            .gte('amount', roundedTotal - 1) 
            .lte('amount', roundedTotal + 1);

        if (error) {
            console.error("   ❌ DB Error:", error.message);
            continue;
        }

        const match = txs.find(t => Math.abs(t.amount - roundedTotal) < 0.05);

        if (match) {
            console.log(`   ✅ MATCH FOUND in DB: ID ${match.id} | Amt: ${match.amount} | Desc: ${match.description}`);
            // Logic to link/reconcile goes here if requested
        } else {
            console.log(`   ⚠️  NO MATCH FOUND in DB.`);
            console.log(`      (Searched Date: ${batch.date}, Amount ~${roundedTotal})`);
            // List potentials?
             const { data: potentials } = await supabase
                .from('bank_transactions')
                .select('id, date, amount, description')
                .eq('date', batch.date);
             if(potentials && potentials.length > 0) {
                 console.log(`      Potential mismatches on same day:`, potentials.map(p => `${p.amount} (${p.description})`).join(', '));
             }
        }
    }
}

auditBatches();
