
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
const BANK_ACCOUNT_ID = '5e4054e1-b9e2-454e-94eb-71cffbbbfd2b'; // Sicredi

function formatOFXDate(ofxDate) {
    if (!ofxDate) return new Date().toISOString().split('T')[0];
    const year = ofxDate.substring(0, 4);
    const month = ofxDate.substring(4, 6);
    const day = ofxDate.substring(6, 8);
    // Ignore time/timezone for now to keep it simple YYYY-MM-DD
    return `${year}-${month}-${day}`;
}

function extractTag(content, tag) {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
}

function parseOFX(content) {
    const transactions = [];
    // Extract all STMTTRN (statement transaction) blocks
    // Note: This regex is simple. OFX can be messy.
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmtTrnRegex.exec(content)) !== null) {
        const trn = match[1];

        const date = extractTag(trn, 'DTPOSTED');
        let amountStr = extractTag(trn, 'TRNAMT').replace(',', '.');
        let amount = parseFloat(amountStr); 
        const fitid = extractTag(trn, 'FITID');
        const name = extractTag(trn, 'NAME');
        const memo = extractTag(trn, 'MEMO');
        const checknum = extractTag(trn, 'CHECKNUM');
        const type = extractTag(trn, 'TRNTYPE'); // CREDIT or DEBIT

        // Adjust amount sign based on type if needed, but usually TRNAMT has the sign (- for debit)
        // Ensure consistency.
        
        const description = memo || name || checknum || type;
        const reference = fitid || `OFX-${Date.now()}-${Math.random()}`;
        
        transactions.push({
            bank_account_id: BANK_ACCOUNT_ID,
            bank_reference: reference, 
            fitid: reference,
            transaction_date: formatOFXDate(date),
            amount: amount, 
            description: description.trim(),
            transaction_type: amount > 0 ? 'credit' : 'debit',
            imported_from: 'OFX',
            matched: false, // Default to unmatched
            reconciled: false // Default to unreconciled
        });
    }

    return { transactions };
}

async function resetFailedTasks() {
    const { error } = await supabase
        .from('import_files')
        .update({ status: 'pending', error_log: null })
        .eq('status', 'error');
    if (error) console.error("Failed to reset tasks", error);
    else console.log("♻️ Reset failed tasks to pending.");
}

async function processOneTask() {
    console.log('\n--- Checking ELT Queue ---');

    const { data: tasks, error } = await supabase
        .from('import_files')
        .select('*')
        .eq('status', 'pending')
        .limit(1);

    if (error) throw error;

    if (!tasks || tasks.length === 0) {
        return false; // No more tasks
    }

    const task = tasks[0];
    console.log(`Processing Task: ${task.id} - ${task.original_name}`);

    // Mark Processing
    await supabase.from('import_files').update({ status: 'processing' }).eq('id', task.id);

    try {
        const { data: fileData, error: downError } = await supabase
            .storage
            .from(task.bucket_id)
            .download(task.file_path);

        if (downError) throw downError;

        const textContent = await fileData.text();
        let parsedRows = [];

        if (task.file_type === 'OFX' || task.original_name.toLowerCase().endsWith('.ofx')) {
            const result = parseOFX(textContent);
            parsedRows = result.transactions;
        } else {
            throw new Error(`Parser for ${task.file_type} not implemented.`);
        }

        console.log(`Parsed ${parsedRows.length} transactions.`);

        // Deduplication
        const { data: existing } = await supabase.from('bank_transactions').select('fitid');
        const existingSet = new Set(existing.map(e => e.fitid));

        const toInsert = [];
        let dupCount = 0;

        for (const row of parsedRows) {
            if (existingSet.has(row.fitid)) {
                dupCount++;
            } else {
                toInsert.push(row);
            }
        }

        console.log(`New: ${toInsert.length}, Duplicates: ${dupCount}`);

        if (toInsert.length > 0) {
            // Batch insert with ignoreDuplicates to handle cases where select() limit missed some, or race conditions
             const { error: insError } = await supabase
                .from('bank_transactions')
                .upsert(toInsert, { onConflict: 'bank_reference', ignoreDuplicates: true });
             
             if (insError) throw insError;
             console.log(`✅ Upserted ${toInsert.length} records (ignoring duplicates).`);
        }

        // Mark Completed
        await supabase
            .from('import_files')
            .update({ 
                status: 'completed',
                processed_at: new Date(),
                processing_metadata: { 
                    lines: parsedRows.length, 
                    inserted: toInsert.length, 
                    duplicates: dupCount,
                    success: true 
                }
            })
            .eq('id', task.id);

    } catch (err) {
        console.error(`❌ Task Failed:`, err);
        await supabase
            .from('import_files')
            .update({ 
                status: 'error',
                error_log: err.message
            })
            .eq('id', task.id);
    }

    return true; // Continue
}

async function runLoop() {
    await resetFailedTasks();
    let running = true;
    while (running) {
        const hasMore = await processOneTask();
        if (!hasMore) {
            console.log('No pending tasks. Exiting.');
            running = false;
        }
        await new Promise(r => setTimeout(r, 1000)); // Cool down
    }
}

runLoop();
